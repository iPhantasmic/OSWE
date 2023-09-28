package main

import (
	"bufio"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"golang.org/x/exp/slices"

	"github.com/iPhantasmic/OSWE/scripts/utils"
)

// Ex 12.3.2.1 - route_buster

func makeRequests(actions []string, target, wordlist string) {
	codes := []int{204, 401, 403, 404}

	file, err := os.Open(wordlist)
	if err != nil {
		log.Fatalln("Failed to open wordlist: ", err)
	}
	defer file.Close()

	fileScanner := bufio.NewScanner(file)
	fileScanner.Split(bufio.ScanLines)

	fmt.Println("Path - \tGet\tPost")

	for fileScanner.Scan() {
		word := strings.TrimSpace(fileScanner.Text())
		for _, action := range actions {
			//fmt.Printf("/%s/%s", word, action)
			url := fmt.Sprintf("%s/%s/%s", target, word, action)

			resp, err := http.Get(url)
			if err != nil {
				log.Println("Failed to send GET request: ", err)
			}
			getResp := resp.StatusCode

			resp, err = http.Post(url, "", nil)
			if err != nil {
				log.Println("Failed to send POST request: ", err)
			}
			postResp := resp.StatusCode

			if !slices.Contains(codes, getResp) || !slices.Contains(codes, postResp) {
				fmt.Println(fmt.Sprintf("/%s/%s - \t%d\t%d", word, action, getResp, postResp))
			}
		}
	}
}

func main() {
	target := flag.String("target", "", "target host/ip")
	actionList := flag.String("actionlist", "", "actionlist to use")
	wordlist := flag.String("wordlist", "", "wordlist")

	// parse args
	flag.Parse()
	args := os.Args[:]
	log.Println("Args: ", args)

	if len(args) < 4 {
		utils.PrintFailure(fmt.Sprintf("usage: %s -target=<URL> -actionlist=<actionlist> -wordlist=<wordlist>", os.Args[0]))
		utils.PrintFailure(fmt.Sprintf("eg: %s -target=http://192.168.249.135:8000 -actionlist=/usr/share/wordlists/dirb/small.txt -wordlist=endpoints_simple.txt", os.Args[0]))
		os.Exit(1)
	}

	var actions []string
	file, err := os.Open(*actionList)
	if err != nil {
		log.Fatalln("Failed to open actionlist: ", err)
	}
	defer file.Close()

	fileScanner := bufio.NewScanner(file)
	fileScanner.Split(bufio.ScanLines)
	for fileScanner.Scan() {
		actions = append(actions, strings.TrimSpace(fileScanner.Text()))
	}

	makeRequests(actions, *target, *wordlist)
	utils.PrintSuccess("Done!")
}
