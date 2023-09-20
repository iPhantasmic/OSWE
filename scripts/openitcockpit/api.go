package main

import (
	"crypto/tls"
	"log"
	"net/http"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"github.com/iPhantasmic/OSWE/scripts/utils"
)

func health(c *gin.Context) {
	c.String(http.StatusOK, "Hello, all is well!")
}

func clientJS(c *gin.Context) {
	c.FileAttachment("./client.js", "client.js")
}

func main() {
	// connect to DB
	utils.ConnectDB("./sqlite.db")

	r := gin.Default()

	// apply middleware
	r.Use(gin.Logger())
	r.Use(gin.Recovery())
	r.Use(cors.Default()) // CORS allow all

	// define routes and corresponding handlers
	r.GET("/health", health)
	r.GET("/client.js", clientJS)

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
