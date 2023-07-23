package utils

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
)

// Helper functions and wrappers for making requests

type PostRequest struct {
	ContentType string
	Cookies     []*http.Cookie
	FormData    url.Values
	JsonData    string
}

type Response struct {
	StatusCode      int
	ContentLength   int64
	ResponseBody    string
	ResponseHeaders map[string]string
}

func SendGetRequest(client *http.Client, debug bool, requestURL string) Response {
	// create our HTTP GET request
	req, err := http.NewRequest(http.MethodGet, requestURL, nil)
	if err != nil {
		log.Fatalln("[-] Failed to create HTTP request: ", err)
	}

	if debug {
		PrintInfo("Sending HTTP GET request to: " + requestURL)
	}
	resp, err := client.Do(req)
	if err != nil {
		log.Fatalln("[-] Failed to send HTTP request: ", err)
	}
	defer resp.Body.Close()
	if debug {
		PrintSuccess("Got HTTP response!")
	}

	// get HTTP response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Fatalln("[-] Failed to read HTTP response body: ", err)
	}
	bodyString := string(body)

	// get HTTP response headers
	respHeaders := make(map[string]string)
	for headerKey, headerValues := range resp.Header {
		respHeaders[headerKey] = strings.Join(headerValues, ", ")
	}

	if debug {
		// print HTTP status code
		PrintInfo(fmt.Sprintf("HTTP response status code: %d", resp.StatusCode))

		// print HTTP content length
		PrintInfo(fmt.Sprintf("HTTP response content length: %d", resp.ContentLength))

		// print HTTP response body
		PrintInfo("Response body: ")
		fmt.Println(bodyString)

		// print HTTP response headers
		PrintInfo("Response headers: ")
		for header, value := range respHeaders {
			fmt.Printf("\t%s = %s\n", header, value)
		}

		fmt.Println("")
	}

	return Response{
		StatusCode:      resp.StatusCode,
		ContentLength:   resp.ContentLength,
		ResponseBody:    bodyString,
		ResponseHeaders: respHeaders,
	}
}

func SendPostRequest(client *http.Client, debug bool, requestURL string, postRequest PostRequest) Response {
	// create our HTTP POST request
	var req *http.Request
	var err error

	// form POST request
	if postRequest.ContentType == "form" {
		req, err = http.NewRequest(http.MethodPost, requestURL, strings.NewReader(postRequest.FormData.Encode()))
		req.Header.Add("Content-Type", "application/x-www-form-urlencoded")
		// we are not using client.PostForm() so we have to specify the Content-Type
		if err != nil {
			log.Fatalln("[-] Failed to create HTTP request: ", err)
		}
	}
	// json POST request
	if postRequest.ContentType == "json" {
		// TODO: properly deal with the json body
		//req, err = http.NewRequest(http.MethodPost, requestURL, strings.NewReader(postRequest.FormData.Encode()))
		//req.Header.Add("Content-Type", "application/json")
		//if err != nil {
		//	log.Fatalln("[-] Failed to create HTTP request: ", err)
		//}
	} else {
		//req, err = http.NewRequest(http.MethodPost, requestURL, TBD)
		//if err != nil {
		//	log.Fatalln("[-] Failed to create HTTP request: ", err)
		//}
	}

	// add cookies to the created request
	for _, cookie := range postRequest.Cookies {
		req.AddCookie(cookie)
	}

	if debug {
		PrintInfo("Sending HTTP POST request to: " + requestURL)
	}
	resp, err := client.Do(req)
	if err != nil {
		log.Fatalln("[-] Failed to send HTTP request: ", err)
	}
	defer resp.Body.Close()
	if debug {
		PrintSuccess("Got HTTP response!")
	}

	// get HTTP response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Fatalln("[-] Failed to read HTTP response body: ", err)
	}
	bodyString := string(body)

	// get HTTP response headers
	respHeaders := make(map[string]string)
	for headerKey, headerValues := range resp.Header {
		respHeaders[headerKey] = strings.Join(headerValues, ", ")
	}

	if debug {
		// print HTTP status code
		PrintInfo(fmt.Sprintf("HTTP response status code: %d", resp.StatusCode))

		// print HTTP content length
		PrintInfo(fmt.Sprintf("HTTP response content length: %d", resp.ContentLength))

		// print HTTP response body
		PrintInfo("Response body: ")
		fmt.Println(bodyString)

		// print HTTP response headers
		PrintInfo("Response headers: ")
		for header, value := range respHeaders {
			fmt.Printf("\t%s = %s\n", header, value)
		}

		fmt.Println("")
	}

	return Response{
		StatusCode:      resp.StatusCode,
		ContentLength:   resp.ContentLength,
		ResponseBody:    bodyString,
		ResponseHeaders: respHeaders,
	}
}
