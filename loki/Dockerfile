FROM grafana/loki:2.3.0

# Cria os diretórios necessários
RUN mkdir -p /tmp/loki/index /tmp/loki/index_cache /tmp/loki/chunks /loki/boltdb-shipper-compactor

# Define permissões para os diretórios
RUN chown -R nobody:nobody /tmp/loki /loki

# Copia o arquivo de configuração
COPY config/loki-local-config.yaml /etc/loki/local-config.yaml

# Define o comando padrão para iniciar o Loki
CMD ["-config.file=/etc/loki/local-config.yaml"]
