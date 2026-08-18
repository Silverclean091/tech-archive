"""Django 기반의 REST API를 정의합니다.

create_report: 사용자로부터 keyword값을 입력받은 뒤 검증하고, 보고서 생성 전체 파이프라인을 실행합니다.
review_report: 사용자에게 보고서를 검토받은 뒤, 응답값에 따라(재수정/승인) 결과값을 반환합니다.
list_reports: DB에 저장된 전체 보고서 목록을 최신순으로 조회합니다.
report_detail: report_id를 기준으로 특정 보고서에 대한 상세 내용을 조회합니다.
download_report: 완성된 보고서를 .docx 확장자 파일로 출력합니다.
"""

import os
from django.http import FileResponse

from rest_framework.decorators import api_view
from rest_framework.response import Response
from .serializers import ReportSerializer

from langgraph.types import Command
from reports.models import Report
from agent.generate import app
from agent.export import export_to_docx


@api_view(["POST"])
def create_report(request):
    """사용자로부터 keyword값을 입력받은 뒤 검증하고, 보고서 생성 전체 파이프라인을 실행합니다."""
    keyword = request.data.get("keyword")
    if not keyword:
        return Response({"error": "keyword 입력은 필수입니다."}, status=400)

    report = Report.objects.create(keyword=keyword)
    config = {"configurable": {"thread_id": str(report.id)}}

    initial_state = {
        "keyword": keyword,
        "report_id": report.id,
        "chunks": [], "outline": "", "draft": "", "retry_count": 0, "human_response": {},
    }
    result = app.invoke(initial_state, config=config)
    return Response({"report_id": report.id, "draft": result["draft"]})

@api_view(["POST"])
def review_report(request, report_id):
    """사용자에게 보고서를 검토받은 뒤, 응답값에 따라(재수정/승인) 결과값을 반환합니다."""
    config = {"configurable": {"thread_id": str(report_id)}}
    result = app.invoke(Command(resume=request.data), config=config)

    if "__interrupt__" in result:
        return Response({"report_id": report_id, "draft": result["draft"]})
    report = Report.objects.get(id=report_id)
    export_to_docx(report)
    return Response({"report_id": report_id, "draft": result["draft"], "status": "completed"})

@api_view(["GET"])
def list_reports(request):
    """DB에 저장된 전체 보고서 목록을 최신순으로 조회합니다."""
    reports = Report.objects.all().order_by("-created_at")
    serializer = ReportSerializer(reports, many=True)
    return Response(serializer.data)

@api_view(["GET"])
def report_detail(request, report_id):
    """report_id를 기준으로 특정 보고서에 대한 상세 내용을 조회합니다."""
    report = Report.objects.get(id=report_id)
    serializer = ReportSerializer(report)
    return Response(serializer.data)

@api_view(["GET"])
def download_report(request, report_id):
    """완성된 보고서를 .docx 확장자 파일로 출력합니다."""
    report = Report.objects.get(id=report_id)
    if not report.file_path or not os.path.exists(report.file_path):
        return Response({"error": "아직 파일이 생성되지 않았습니다."}, status=404)

    return FileResponse(
        open(report.file_path, "rb"),
        as_attachment=True,
        filename=os.path.basename(report.file_path)
    )