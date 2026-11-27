#include "TifloPDFPostprocess.h"
#include <libxml/HTMLparser.h>
#include <libxml/tree.h>
#include <stdlib.h>
#include <string.h>

// The HTML parser treats input as data, not a browsing context. No network,
// external DTD loading, entity substitution, or relaxed parser limits.
int tiflo_html_normalize(const unsigned char *input, size_t length,
                         unsigned char **output, size_t *output_length) {
    if (!output || !output_length) return -1;
    *output = NULL;
    *output_length = 0;
    if (!input || length == 0 || length > 16u * 1024u * 1024u) return -1;
    htmlDocPtr doc = htmlReadMemory((const char *)input, (int)length,
        NULL, "UTF-8", HTML_PARSE_RECOVER | HTML_PARSE_NONET |
        HTML_PARSE_NOERROR | HTML_PARSE_NOWARNING | HTML_PARSE_NODEFDTD);
    if (!doc) return -1;
    xmlNodePtr root = xmlDocGetRootElement(doc);
    xmlBufferPtr buffer = xmlBufferCreate();
    int result = -1;
    // Serialize only the element tree, never the source DOCTYPE or DTD.
    if (root && buffer && xmlNodeDump(buffer, doc, root, 0, 0) >= 0) {
        size_t count = (size_t)xmlBufferLength(buffer);
        if (count > 0 && count <= 32u * 1024u * 1024u) {
            unsigned char *copy = malloc(count);
            if (copy) {
                memcpy(copy, xmlBufferContent(buffer), count);
                *output = copy;
                *output_length = count;
                result = 0;
            }
        }
    }
    if (buffer) xmlBufferFree(buffer);
    xmlFreeDoc(doc);
    return result;
}

void tiflo_html_normalize_free(unsigned char *output) { free(output); }
