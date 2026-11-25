#include "TifloPDFPostprocess.h"
#include <qpdf/qpdf-c.h>

// Quartz emits a flat number tree for its page marked-content references.
static int attach_link(qpdf_data pdf, qpdf_oh tree, qpdf_oh numbers,
                       qpdf_oh page, qpdf_oh annotation, long long key) {
    if (!qpdf_oh_is_indirect(pdf, tree) || !qpdf_oh_is_indirect(pdf, page) ||
        !qpdf_oh_is_indirect(pdf, annotation)) return 0;
    qpdf_oh document = qpdf_oh_get_key(pdf, tree, "/K");
    if (qpdf_oh_is_indirect(pdf, document) && qpdf_oh_is_dictionary(pdf, document) &&
        qpdf_oh_is_name_and_equals(pdf, qpdf_oh_get_key(pdf, document, "/S"), "/Document")) tree = document;
    qpdf_oh kids = qpdf_oh_get_key(pdf, tree, "/K");
    if (!qpdf_oh_is_array(pdf, kids)) {
        qpdf_oh earlier = kids;
        kids = qpdf_oh_new_array(pdf);
        if (!qpdf_oh_is_null(pdf, earlier)) qpdf_oh_append_item(pdf, kids, earlier);
        qpdf_oh_replace_key(pdf, tree, "/K", kids);
    }
    qpdf_oh reference = qpdf_oh_new_dictionary(pdf);
    qpdf_oh_replace_key(pdf, reference, "/Type", qpdf_oh_new_name(pdf, "/OBJR"));
    qpdf_oh_replace_key(pdf, reference, "/Obj", annotation);
    qpdf_oh_replace_key(pdf, reference, "/Pg", page);
    qpdf_oh node = qpdf_make_indirect_object(pdf, qpdf_oh_new_dictionary(pdf));
    qpdf_oh_replace_key(pdf, node, "/Type", qpdf_oh_new_name(pdf, "/StructElem"));
    qpdf_oh_replace_key(pdf, node, "/S", qpdf_oh_new_name(pdf, "/Link"));
    qpdf_oh_replace_key(pdf, node, "/P", tree);
    qpdf_oh_replace_key(pdf, node, "/Pg", page);
    qpdf_oh_replace_key(pdf, node, "/K", reference);
    qpdf_oh description = qpdf_oh_get_key(pdf, annotation, "/Contents");
    if (qpdf_oh_is_string(pdf, description)) qpdf_oh_replace_key(pdf, node, "/Alt", description);
    qpdf_oh_replace_key(pdf, annotation, "/StructParent", qpdf_oh_new_integer(pdf, key));
    qpdf_oh_append_item(pdf, numbers, qpdf_oh_new_integer(pdf, key));
    qpdf_oh_append_item(pdf, numbers, node);
    qpdf_oh_append_item(pdf, kids, node);
    return 1;
}

// Quartz writes page-local MCIDs and their structure elements but may omit
// the reverse lookup required by readers and validators.
static void complete_quartz_parent_tree(qpdf_data pdf, qpdf_oh tree, int pages) {
    if (!qpdf_oh_is_null(pdf, qpdf_oh_get_key(pdf, tree, "/ParentTree"))) return;
    qpdf_oh document = qpdf_oh_get_key(pdf, tree, "/K");
    if (!qpdf_oh_is_dictionary(pdf, document)) return;
    qpdf_oh children = qpdf_oh_get_key(pdf, document, "/K");
    if (!qpdf_oh_is_array(pdf, children) || pages < 1 || pages > 100000) return;

    int count = qpdf_oh_get_array_n_items(pdf, children);
    qpdf_oh page_refs = qpdf_oh_new_array(pdf);
    qpdf_oh numbers = qpdf_oh_new_array(pdf);
    for (int i = 0; i < pages; ++i) {
        qpdf_oh refs = qpdf_oh_new_array(pdf);
        qpdf_oh_append_item(pdf, page_refs, refs);
    }
    int page_index = 0;
    long long allocated_slots = 0;
    qpdf_oh page = qpdf_get_page_n(pdf, page_index);
    for (int i = 0; i < count; ++i) {
        qpdf_oh child = qpdf_oh_get_array_item(pdf, children, i);
        if (!qpdf_oh_is_indirect(pdf, child) || !qpdf_oh_is_dictionary(pdf, child)) return;
        qpdf_oh content = qpdf_oh_get_key(pdf, child, "/K");
        qpdf_oh child_page = qpdf_oh_get_key(pdf, child, "/Pg");
        if (!qpdf_oh_is_integer(pdf, content) || !qpdf_oh_is_indirect(pdf, child_page)) return;
        while (qpdf_oh_get_object_id(pdf, page) != qpdf_oh_get_object_id(pdf, child_page)) {
            if (++page_index >= pages) return;
            page = qpdf_get_page_n(pdf, page_index);
        }
        long long mcid = qpdf_oh_get_int_value(pdf, content);
        if (mcid < 0 || mcid >= 100000) return;
        qpdf_oh refs = qpdf_oh_get_array_item(pdf, page_refs, page_index);
        int existing = qpdf_oh_get_array_n_items(pdf, refs);
        if (existing <= mcid) {
            allocated_slots += mcid + 1 - existing;
            if (allocated_slots > 1000000) return;
            for (long long j = existing; j <= mcid; ++j)
                qpdf_oh_append_item(pdf, refs, qpdf_oh_new_null(pdf));
        }
        if (!qpdf_oh_is_null(pdf, qpdf_oh_get_array_item(pdf, refs, (int)mcid))) return;
        qpdf_oh_set_array_item(pdf, refs, (int)mcid, child);
    }
    if (!count) return;
    for (int i = 0; i < pages; ++i) {
        qpdf_oh refs = qpdf_oh_get_array_item(pdf, page_refs, i);
        if (qpdf_oh_get_array_n_items(pdf, refs) == 0) continue;
        qpdf_oh_replace_key(pdf, qpdf_get_page_n(pdf, i), "/StructParents", qpdf_oh_new_integer(pdf, i));
        qpdf_oh_append_item(pdf, numbers, qpdf_oh_new_integer(pdf, i));
        qpdf_oh_append_item(pdf, numbers, refs);
    }
    qpdf_oh parent_tree = qpdf_make_indirect_object(pdf, qpdf_oh_new_dictionary(pdf));
    qpdf_oh_replace_key(pdf, parent_tree, "/Nums", numbers);
    qpdf_oh_replace_key(pdf, tree, "/ParentTree", parent_tree);
}

int tiflo_pdf_postprocess(const char *input, const char *output, const char *language,
                          const char *const *labels, size_t label_count) {
    qpdf_data pdf = qpdf_init();
    if (!pdf) return QPDF_ERRORS;
    qpdf_silence_errors(pdf);
    qpdf_set_suppress_warnings(pdf, 1);
    // Quartz may emit unused objects at offset zero. qpdf repairs these on output.
    int result = qpdf_read(pdf, input, 0) & QPDF_ERRORS;
    if (result != 0 || qpdf_has_error(pdf)) goto failed;

    qpdf_oh root = qpdf_get_root(pdf);
    qpdf_oh preferences = qpdf_oh_get_key(pdf, root, "/ViewerPreferences");
    if (!qpdf_oh_is_dictionary(pdf, preferences)) {
        preferences = qpdf_oh_new_dictionary(pdf);
        qpdf_oh_replace_key(pdf, root, "/ViewerPreferences", preferences);
    }
    qpdf_oh_replace_key(pdf, preferences, "/DisplayDocTitle", qpdf_oh_new_bool(pdf, 1));
    if (language && language[0]) {
        qpdf_oh_replace_key(pdf, root, "/Lang", qpdf_oh_new_unicode_string(pdf, language));
    }

    int pages = qpdf_get_num_pages(pdf);
    size_t total_links = 0;
    for (int i = 0; i < pages; ++i) {
        qpdf_oh page = qpdf_get_page_n(pdf, i);
        qpdf_oh annotations = qpdf_oh_get_key(pdf, page, "/Annots");
        if (!qpdf_oh_is_array(pdf, annotations)) continue;
        int count = qpdf_oh_get_array_n_items(pdf, annotations);
        for (int j = 0; j < count; ++j) {
            qpdf_oh annotation = qpdf_oh_get_array_item(pdf, annotations, j);
            qpdf_oh subtype = qpdf_oh_get_key(pdf, annotation, "/Subtype");
            if (qpdf_oh_is_name_and_equals(pdf, subtype, "/Link")) ++total_links;
        }
    }

    qpdf_oh tree = qpdf_oh_get_key(pdf, root, "/StructTreeRoot");
    qpdf_oh numbers = 0;
    long long next_key = 0;
    if (qpdf_oh_is_dictionary(pdf, tree)) {
        complete_quartz_parent_tree(pdf, tree, pages);
        qpdf_oh parent_tree = qpdf_oh_get_key(pdf, tree, "/ParentTree");
        if (qpdf_oh_is_dictionary(pdf, parent_tree) &&
            qpdf_oh_is_null(pdf, qpdf_oh_get_key(pdf, parent_tree, "/Kids")) &&
            qpdf_oh_is_null(pdf, qpdf_oh_get_key(pdf, parent_tree, "/Limits"))) {
            qpdf_oh entries = qpdf_oh_get_key(pdf, parent_tree, "/Nums");
            if (qpdf_oh_is_array(pdf, entries)) {
                int count = qpdf_oh_get_array_n_items(pdf, entries);
                if (count % 2 == 0) numbers = entries;
                for (int i = 0; numbers && i < count; i += 2) {
                    qpdf_oh entry = qpdf_oh_get_array_item(pdf, entries, i);
                    if (!qpdf_oh_is_integer(pdf, entry)) { numbers = 0; break; }
                    long long key = qpdf_oh_get_int_value(pdf, entry);
                    if (key < 0 || key > 1000000000) { numbers = 0; break; }
                    if (key >= next_key) next_key = key + 1;
                }
            }
        }
    }
    size_t label = 0;
    for (int i = 0; i < pages; ++i) {
        qpdf_oh page = qpdf_get_page_n(pdf, i);
        qpdf_oh annotations = qpdf_oh_get_key(pdf, page, "/Annots");
        if (!qpdf_oh_is_array(pdf, annotations)) continue;
        qpdf_oh_replace_key(pdf, page, "/Tabs", qpdf_oh_new_name(pdf, "/S"));
        if (total_links != label_count) continue;
        int count = qpdf_oh_get_array_n_items(pdf, annotations);
        for (int j = 0; j < count; ++j) {
            qpdf_oh annotation = qpdf_oh_get_array_item(pdf, annotations, j);
            qpdf_oh subtype = qpdf_oh_get_key(pdf, annotation, "/Subtype");
            if (!qpdf_oh_is_name_and_equals(pdf, subtype, "/Link")) continue;
            if (labels[label] && labels[label][0]) {
                qpdf_oh_replace_key(pdf, annotation, "/Contents", qpdf_oh_new_unicode_string(pdf, labels[label]));
            }
            if (numbers && qpdf_oh_is_null(pdf, qpdf_oh_get_key(pdf, annotation, "/StructParent")) &&
                attach_link(pdf, tree, numbers, page, annotation, next_key)) ++next_key;
            ++label;
        }
    }

    if (numbers && next_key > 0)
        qpdf_oh_replace_key(pdf, tree, "/ParentTreeNextKey", qpdf_oh_new_integer(pdf, next_key));
    if (qpdf_has_error(pdf)) goto failed;
    result = qpdf_init_write(pdf, output) & QPDF_ERRORS;
    if (result != 0 || qpdf_has_error(pdf)) goto failed;
    result = qpdf_write(pdf) & QPDF_ERRORS;
    if (result != 0 || qpdf_has_error(pdf)) goto failed;
    qpdf_cleanup(&pdf);
    return 0;
failed:
    result = QPDF_ERRORS;
    qpdf_cleanup(&pdf);
    return result;
}
