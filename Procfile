release: python manage.py migrate && python manage.py collectstatic --noinput
web: gunicorn trucking_eld.wsgi:application
