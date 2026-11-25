#include <cairo.h>
#include <cairo-pdf.h>
#include <qpdf/qpdf-c.h>

int main(void) {
    cairo_surface_t *surface = cairo_pdf_surface_create("probe.pdf", 200, 200);
    cairo_t *context = cairo_create(surface);
    cairo_tag_begin(context, "Document", 0);
    cairo_tag_begin(context, "P", 0);
    cairo_move_to(context, 10, 30);
    cairo_show_text(context, "TifloLector");
    cairo_tag_end(context, "P");
    cairo_tag_end(context, "Document");
    cairo_destroy(context);
    cairo_surface_finish(surface);
    cairo_status_t status = cairo_surface_status(surface);
    cairo_surface_destroy(surface);
    if (status != CAIRO_STATUS_SUCCESS) return 1;
    qpdf_data pdf = qpdf_init();
    int result = qpdf_read(pdf, "probe.pdf", 0);
    qpdf_cleanup(&pdf);
    return result;
}
