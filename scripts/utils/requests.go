package utils

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
)

// Helper functions and wrappers for making requests

type Response struct {
	StatusCode      int
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
		PrintInfo("Sending HTTP request to: " + requestURL)
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

		// print HTTP response body
		PrintInfo("Response body: ")
		fmt.Println(bodyString)

		// print HTTP response headers
		PrintInfo("Response headers: ")
		for header, value := range respHeaders {
			fmt.Printf("\t%s = %s\n", header, value)
		}
	}

	fmt.Println("")
	return Response{
		StatusCode:      resp.StatusCode,
		ResponseBody:    bodyString,
		ResponseHeaders: respHeaders,
	}
}
