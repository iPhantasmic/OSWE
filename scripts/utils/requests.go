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

func SendPostRequestForm(client *http.Client, debug bool, requestURL string, data url.Values) Response {
	// create our HTTP POST request
	req, err := http.NewRequest(http.MethodPost, requestURL, strings.NewReader(data.Encode()))
	req.Header.Add("Content-Type", "application/x-www-form-urlencoded")
	// we are not using client.PostForm() so we have to specify the Content-Type
	if err != nil {
		log.Fatalln("[-] Failed to create HTTP request: ", err)
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
