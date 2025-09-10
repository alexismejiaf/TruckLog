# Sample Data Creation Script
from routes.models import Driver, Trip
from logs.models import ELDLog, DailyLogSheet

# Create sample drivers
driver1 = Driver.objects.create(
    name="John Smith",
    license_number="CDL123456"
)

driver2 = Driver.objects.create(
    name="Sarah Johnson", 
    license_number="CDL789012"
)

driver3 = Driver.objects.create(
    name="Mike Williams",
    license_number="CDL345678"
)

print("Sample drivers created successfully!")
print(f"Created drivers: {Driver.objects.count()}")
