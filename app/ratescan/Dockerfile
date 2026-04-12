# Python 3.13 is the confirmed latest Lambda base image.
# To use Python 3.14 once available, run:
#   docker pull public.ecr.aws/lambda/python:3.14
# then replace the FROM line below.
FROM public.ecr.aws/lambda/python:3.13

# gcc-c++ is required to compile pyarrow extensions
RUN dnf install -y gcc-c++ && dnf clean all

COPY requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install --no-cache-dir -r ${LAMBDA_TASK_ROOT}/requirements.txt

COPY main.py \
     main_prod_details.py \
     flatten_json_to_csv.py \
     upsert_dataset.py \
     generate_bank_list.py \
     config.json \
     ${LAMBDA_TASK_ROOT}/

# Default handler — SAM/Lambda overrides this per function via ImageConfig.Command
CMD ["main.lambda_handler"]
