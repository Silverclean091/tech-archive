"""구현된 API와 URL을 라우팅합니다."""

from django.urls import path
from reports import views

urlpatterns = [
    path("reports/create/", views.create_report, name="report-create"),
    path("reports/list/", views.list_reports, name="report-list"),
    path("reports/<int:report_id>/", views.report_detail, name="report-detail"),
    path("reports/<int:report_id>/review/", views.review_report, name="report-review"),
    path("reports/<int:report_id>/download/", views.download_report, name="report-download"),
]