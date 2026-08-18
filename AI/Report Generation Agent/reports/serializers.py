"""DRF가 제공하는 모듈을 사용하여 serializers를 정의합니다."""

from rest_framework import serializers
from .models import Report

class ReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = "__all__"