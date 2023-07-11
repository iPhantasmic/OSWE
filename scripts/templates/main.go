package main

import (
	"crypto/tls"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
)

// Welcome to OSWE in Golang

const baseURL = "https://192.168.219.113:8443/"
const proxyURL = "http://127.0.0.1:8080"

func printInfo(message string) {
	log.Println("[=] " + message)
}

func printSuccess(message string) {
	log.Println("\033[32m[+] \033[0m" + message)
}

func sendGetRequest(client *http.Client, requestURL string) {
	// do necessary URL manipulation

	// create our HTTP GET request
	req, err := http.NewRequest(http.MethodGet, requestURL, nil)
	if err != nil {
		log.Fatalln("[-] Failed to create HTTP request: ", err)
	}

	printInfo("Sending HTTP request to: " + requestURL)
	resp, err := client.Do(req)
	if err != nil {
		log.Fatalln("[-] Failed to send HTTP request: ", err)
	}
	defer resp.Body.Close()
	printSuccess("Got HTTP response!")

	// get HTTP status code
	printInfo(fmt.Sprintf("HTTP response status code: %d", resp.StatusCode))

	// get HTTP response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Fatalln("[-] Failed to read HTTP response body: ", err)
	}
	printInfo("Response body: ")
	fmt.Println(string(body))

	// get HTTP response headers
	printInfo("Response headers: ")
	//respHeaders := make(map[string]string)
	for headerKey, headerValues := range resp.Header {
		fmt.Printf("\t%s = %s\n", headerKey, strings.Join(headerValues, ", "))
		//for _, headerValue := range headerValues {
		//	respHeaders[headerKey] = headerValue
		//}
	}
}

func postRequest(client *http.Client, requestURL string) {
	// do necessary URL manipulation

	// create our HTTP POST request
	req, err := http.NewRequest(http.MethodPost, requestURL, nil)
	if err != nil {
		log.Fatalln("[-] Failed to create HTTP request: ", err)
	}

	printInfo("Sending HTTP request to: " + requestURL)
	resp, err := client.Do(req)
	if err != nil {
		log.Fatalln("[-] Failed to send HTTP request: ", err)
	}
	defer resp.Body.Close()
	printSuccess("Got HTTP response!")

	// get HTTP status code
	printInfo(fmt.Sprintf("HTTP response status code: %d", resp.StatusCode))

	// get HTTP response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Fatalln("[-] Failed to read HTTP response body: ", err)
	}
	printInfo("Response body: ")
	fmt.Println(string(body))
}

func main() {
	var tr *http.Transport
	useProxy := flag.Bool("proxy", false, "use proxy")
	flag.Parse()
	// parse args
	args := os.Args[1:]
	log.Println("Args: ", args)

	if *useProxy {
		// disable TLS verification and set proxy URL
		proxyUrl, _ := url.Parse(proxyURL)
		tr = &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
			Proxy:           http.ProxyURL(proxyUrl),
		}
	} else {
		tr = &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		}
	}

	// create our HTTP client using the above transport
	client := &http.Client{Transport: tr}

	sendGetRequest(client, baseURL)
}
