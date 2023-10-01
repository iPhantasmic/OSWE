package main

import (
	"log"
	"net/url"

	"github.com/gin-gonic/gin"
)

// Ex 12.6.3.2 - Extra Mile: Decode JS callbacks

func callback(c *gin.Context) {
	encodedData := c.Query("payload")

	decoded, err := url.QueryUnescape(encodedData)
	if err != nil {
		log.Println("Failed to decode: ", err)
	}

	log.Println("Decoded Data: " + decoded)

	c.Status(200)
}

func main() {
	router := gin.Default()

	router.GET("/callback", callback)

	router.Run(":1337")
}
