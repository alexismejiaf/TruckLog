release: python manage.py migrate && python manage.py collectstatic --noinput && python manage.py create_sample_data
web: gunicorn trucking_eld.wsgi:application
