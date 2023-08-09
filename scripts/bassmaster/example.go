package main

import (
	"crypto/tls"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"

	"github.com/iPhantasmic/OSWE/scripts/utils"
)

// Chp 6.3 - Vulnerability Discovery

var client *http.Client

const proxyURL = "http://127.0.0.1:8080"

func sendExample(debug bool, ip string) {
	// do necessary URL manipulation
	requestURL := fmt.Sprintf("http://%s:8080/batch", ip)

	jsonStruct := map[string]interface{}{
		"requests": []map[string]interface{}{
			{"method": "get", "path": "/profile"},
			{"method": "get", "path": "/item"},
			{"method": "get", "path": "/item/$1.id"},
		},
	}

	jsonData, err := json.Marshal(jsonStruct)
	if err != nil {
		log.Fatalln("Failed to marshal jsonStruct: ", err)
	}

	postRequest := utils.PostRequest{
		ContentType: "json",
		JsonData:    jsonData,
	}

	// send the request
	response := utils.SendPostRequest(client, debug, requestURL, postRequest)

	// check output of response
	if response.StatusCode != 200 {
		utils.PrintFailure("Something went wrong... Check proxy to debug!")
		os.Exit(1)
	}
}

func main() {
	var tr *http.Transport
	useProxy := flag.Bool("proxy", false, "use proxy")
	debug := flag.Bool("debug", false, "debug mode")
	flag.Parse()
	// parse args
	args := os.Args[:]
	log.Println("Args: ", args)

	if len(args) < 2 {
		utils.PrintFailure(fmt.Sprintf("usage: %s [-proxy=<proxyIP>] <target>", os.Args[0]))
		utils.PrintFailure(fmt.Sprintf("eg: %s 192.168.121.103", os.Args[0]))
		os.Exit(1)
	}

	ip := flag.Arg(0)

	if *useProxy {
		// disable TLS verification and set proxy URL
		proxyUrl, _ := url.Parse(proxyURL)
		tr = &http.Transport{
			TLSClientConfig:    &tls.Config{InsecureSkipVerify: true},
			DisableCompression: true, // to ensure that we can obtain Content-Length response header
			Proxy:              http.ProxyURL(proxyUrl),
		}
	} else {
		tr = &http.Transport{
			TLSClientConfig:    &tls.Config{InsecureSkipVerify: true},
			DisableCompression: true, // to ensure that we can obtain Content-Length response header
		}
	}

	// create our HTTP client using the above transport and set the global variable
	client = &http.Client{
		Transport: tr,
	}

	sendExample(*debug, ip)
	utils.PrintSuccess("Done!")
}
