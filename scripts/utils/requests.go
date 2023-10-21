package utils

import (
	"bytes"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"strings"
)

// Helper functions and wrappers for making requests

type GetRequest struct {
	AuthUser string
	AuthPass string
}

type PostRequest struct {
	AuthUser      string
	AuthPass      string
	ContentType   string
	Cookies       []*http.Cookie
	FormData      url.Values
	Headers       map[string]string
	JsonData      []byte
	MultipartData map[string]string
	XmlData       []byte
}

type DeleteRequest struct {
	AuthUser string
	AuthPass string
}

type Response struct {
	StatusCode      int
	ContentLength   int64
	ResponseBody    string
	ResponseHeaders map[string]string
}

func SendGetRequest(client *http.Client, debug bool, requestURL string, getRequest GetRequest) Response {
	// create our HTTP GET request
	req, err := http.NewRequest(http.MethodGet, requestURL, nil)
	if err != nil {
		log.Fatalln("[-] Failed to create HTTP request: ", err)
	}

	if getRequest.AuthUser != "" {
		req.SetBasicAuth(getRequest.AuthUser, getRequest.AuthPass)
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

func CreateMultipartFormData(form map[string]string) (b bytes.Buffer, w *multipart.Writer) {
	w = multipart.NewWriter(&b)

	for key, value := range form {
		if strings.HasPrefix(value, "@") {
			// write file to part
			value = value[1:]
			file, err := os.Open(value)
			if err != nil {
				log.Fatalln(fmt.Sprintf("Error while opening file %s: ", value), err)
			}

			part, err := w.CreateFormFile(key, value)
			if err != nil {
				log.Fatalln(fmt.Sprintf("Error while creating part %s: ", key), err)
			}

			_, err = io.Copy(part, file)
			if err != nil {
				log.Fatalln("Error writing file to part: ", err)
			}

			file.Close()
		} else {
			// write string to part
			if err := w.WriteField(key, value); err != nil {
				log.Fatalln("Error writing string to part: ", err)
			}
		}
	}

	return b, w
}

func SendPostRequest(client *http.Client, debug bool, requestURL string, postRequest PostRequest) Response {
	// create our HTTP POST request
	var req *http.Request
	var buffer bytes.Buffer
	var mpWriter *multipart.Writer
	var err error

	// multipart form POST request
	if postRequest.ContentType == "multipart" {
		buffer, mpWriter = CreateMultipartFormData(postRequest.MultipartData)
		req, err = http.NewRequest(http.MethodPost, requestURL, &buffer)
		req.Header.Add("Content-Type", mpWriter.FormDataContentType())
		if err != nil {
			log.Fatalln("[-] Failed to create HTTP request: ", err)
		}
	}

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
		if debug {
			PrintInfo("JSON HTTP POST payload:")
			fmt.Println(string(postRequest.JsonData))
		}
		req, err = http.NewRequest(http.MethodPost, requestURL, bytes.NewBuffer(postRequest.JsonData))
		req.Header.Add("Content-Type", "application/json")
		if err != nil {
			log.Fatalln("[-] Failed to create HTTP request: ", err)
		}
	}

	// xml POST request
	if postRequest.ContentType == "xml" {
		if debug {
			PrintInfo("XML HTTP POST payload:")
			fmt.Println(string(postRequest.XmlData))
		}
		req, err = http.NewRequest(http.MethodPost, requestURL, bytes.NewBuffer(postRequest.XmlData))
		req.Header.Add("Content-Type", "application/xml")
		if err != nil {
			log.Fatalln("[-] Failed to create HTTP request: ", err)
		}
	}

	if postRequest.ContentType == "none" {
		req, err = http.NewRequest(http.MethodPost, requestURL, nil)
		if err != nil {
			log.Fatalln("[-] Failed to create HTTP request: ", err)
		}
	}

	if postRequest.ContentType != "none" && postRequest.ContentType != "multipart" && postRequest.ContentType != "form" && postRequest.ContentType != "json" && postRequest.ContentType != "xml" {
		log.Fatalln("[-] Failed to create HTTP request: Invalid POST request mode - " + postRequest.ContentType)
	}

	if postRequest.AuthUser != "" {
		req.SetBasicAuth(postRequest.AuthUser, postRequest.AuthPass)
	}

	for key, value := range postRequest.Headers {
		req.Header.Add(key, value)
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

func SendDeleteRequest(client *http.Client, debug bool, requestURL string, deleteRequest DeleteRequest) Response {
	// create our HTTP DELETE request
	req, err := http.NewRequest(http.MethodDelete, requestURL, nil)
	if err != nil {
		log.Fatalln("[-] Failed to create HTTP request: ", err)
	}

	if deleteRequest.AuthUser != "" {
		req.SetBasicAuth(deleteRequest.AuthUser, deleteRequest.AuthPass)
	}

	if debug {
		PrintInfo("Sending HTTP DELETE request to: " + requestURL)
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
