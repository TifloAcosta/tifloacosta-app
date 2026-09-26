package com.tifloacosta.app.reading;

public final class ReadingBookQuery {
    private final String query;
    private final String status;
    private final String sort;
    private final int limit;
    private final int offset;

    public ReadingBookQuery(String query, String status, String sort, int limit, int offset) {
        this.query = query == null ? "" : query.trim();
        this.status = validateStatus(status == null ? "all" : status);
        this.sort = validateSort(sort == null ? "lastRead" : sort);
        if (limit <= 0) {
            throw new IllegalArgumentException("limit must be greater than zero");
        }
        if (offset < 0) {
            throw new IllegalArgumentException("offset must not be negative");
        }
        this.limit = limit;
        this.offset = offset;
    }

    private static String validateStatus(String status) {
        switch (status) {
            case "all":
            case "not-read":
            case "in-reading":
            case "read":
                return status;
            default:
                throw new IllegalArgumentException("Unsupported reading status: " + status);
        }
    }

    private static String validateSort(String sort) {
        switch (sort) {
            case "title":
            case "imported":
            case "lastRead":
                return sort;
            default:
                throw new IllegalArgumentException("Unsupported reading sort: " + sort);
        }
    }

    public String getQuery() { return query; }
    public String getStatus() { return status; }
    public String getSort() { return sort; }
    public int getLimit() { return limit; }
    public int getOffset() { return offset; }
}
