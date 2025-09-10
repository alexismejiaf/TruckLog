from django.urls import path
from . import views

urlpatterns = [
    # Driver endpoints
    path('drivers/', views.DriverListCreateView.as_view(), name='driver-list-create'),
    
    # Trip endpoints
    path('trips/', views.TripListCreateView.as_view(), name='trip-list-create'),
    
    # Route calculation
    path('calculate-route/', views.calculate_route, name='calculate-route'),
    
    # ELD Log endpoints
    path('eld-logs/', views.ELDLogListCreateView.as_view(), name='eld-log-list-create'),
    path('daily-logs/', views.DailyLogSheetListView.as_view(), name='daily-log-list'),
    path('hos-violations/', views.HOSViolationListView.as_view(), name='hos-violation-list'),
    path('download-daily-log/<int:log_id>/', views.download_daily_log, name='download-daily-log'),
]
