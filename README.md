# 📚 Documentação do Projeto

## 🌐 Visão Geral

Este projeto é uma aplicação hospedada em uma instância Amazon Lightsail rodando Ubuntu 22.04. A aplicação é composta por vários serviços Docker, incluindo Elasticsearch, Kibana, Logstash, Prometheus, Grafana, Loki, Promtail e uma API Node.js. Este documento fornece uma visão geral técnica detalhada de cada serviço, os endpoints disponíveis e um guia passo a passo para configurar e executar o projeto.

## 🗂️ Estrutura do Projeto

```
.
├── api
│ ├── index.js
│ ├── indexData.js
│ ├── package.json
│ ├── utils
│ │ ├── executeSearch.js
│ │ ├── extractSearchTerms.js
│ │ ├── generateQuery.js
│ │ └── validateElasticsearchQuery.js
│ └── yarn.lock
├── data
│ ├── livros.json
│ ├── ocr.js
│ ├── res.json
│ ├── script.js
│ ├── test.json
│ └── teste.js
├── docker-compose.yml
├── grafana
│ └── provisioning
│ └── dashboards
│ ├── custom_dashboard.json
│ └── custom_dashboard.yaml
├── logstash
│ └── logstash.conf
├── loki
│ └── config
│ └── loki-local-config.yaml
├── prometheus
│ └── prometheus.yml
└── promtail
└── config
└── promtail-config.yaml
```

## ⚙️ Configuração do Ambiente

### 🐳 Instalação do Docker e Docker Compose

1. **Atualize o sistema e instale o Docker:**

   ```
   sudo apt update
   sudo apt install docker.io
   ```

2. **Instale o Docker Compose (versão 1.28.2):**

   ```
   sudo curl -L "https://github.com/docker/compose/releases/download/1.28.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

3. **Verifique a instalação do Docker Compose:**
   ```
   docker-compose --version
   ```

### 🛠️ Clonando o Repositório

1. **Clone o repositório do projeto:**
   ```
   git clone https://github.com/username/repository-name.git
   cd repository-name
   ```

## 🐳 Configuração dos Contêineres

### Arquivo `docker-compose.yml`

```
version: '3.8'

services:
elasticsearch:
image: docker.elastic.co/elasticsearch/elasticsearch:7.14.0
container_name: elasticsearch
environment: - discovery.type=single-node - ES_JAVA_OPTS=-Xms512m -Xmx512m
ulimits:
memlock:
soft: -1
hard: -1
volumes: - esdata:/usr/share/elasticsearch/data
ports: - 9200:9200 - 9300:9300

kibana:
image: docker.elastic.co/kibana/kibana:7.14.0
container_name: kibana
ports: - 5601:5601
environment:
ELASTICSEARCH_URL: http://elasticsearch:9200

logstash:
image: docker.elastic.co/logstash/logstash:7.14.0
container_name: logstash
volumes: - ./logstash/logstash.conf:/usr/share/logstash/pipeline/logstash.conf
ports: - 5044:5044
depends_on: - elasticsearch
environment: - LS_JAVA_OPTS=-Xms512m -Xmx512m

prometheus:
image: prom/prometheus:latest
container_name: prometheus
volumes: - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
ports: - 9090:9090

grafana:
image: grafana/grafana:latest
container_name: grafana
volumes: - grafana-storage:/var/lib/grafana - ./grafana/provisioning:/etc/grafana/provisioning
ports: - 3000:3000
environment: - GF_SECURITY_ADMIN_PASSWORD=admin

loki:
image: grafana/loki:2.3.0
container_name: loki
ports: - 3100:3100
volumes: - ./loki/config:/mnt/config
command: -config.file=/mnt/config/loki-local-config.yaml

promtail:
image: grafana/promtail:2.3.0
container_name: promtail
volumes: - /var/log:/var/log - ./promtail/config:/etc/promtail
command: -config.file=/etc/promtail/promtail-config.yaml

api:
image: node:20.15.1
container_name: api
working_dir: /usr/src/app
volumes: - ./api:/usr/src/app
ports: - 9900:9900
depends_on: - elasticsearch - prometheus - loki
environment: - NODE_ENV=production - LOGSTASH_HOST=logstash:5044

volumes:
esdata:
driver: local
grafana-storage:
driver: local
```

### Serviços e suas Funcionalidades

1. **🔍 Elasticsearch**

   - **Versão:** 7.14.0
   - **Portas:** 9200 (HTTP), 9300 (TCP)
   - **Função:** Armazena e pesquisa dados de texto completo. Utilizado pela API para buscas.

2. **📊 Kibana**

   - **Versão:** 7.14.0
   - **Porta:** 5601
   - **Função:** Interface de usuário para visualizar dados no Elasticsearch.

3. **🔄 Logstash**

   - **Versão:** 7.14.0
   - **Porta:** 5044
   - **Função:** Coleta, processa e envia logs para o Elasticsearch.

4. **📈 Prometheus**

   - **Versão:** latest
   - **Porta:** 9090
   - **Função:** Sistema de monitoramento e alerta para coletar métricas dos contêineres.

5. **📉 Grafana**

   - **Versão:** latest
   - **Porta:** 3000
   - **Função:** Plataforma de análise e visualização de métricas.

6. **📝 Loki**

   - **Versão:** 2.3.0
   - **Porta:** 3100
   - **Função:** Sistema de log para coletar e consultar logs.

7. **📥 Promtail**

   - **Versão:** 2.3.0
   - **Função:** Agente para enviar logs para o Loki.

8. **🌐 API (Node.js)**
   - **Versão:** 20.15.1
   - **Porta:** 9900
   - **Função:** Serviço backend que processa as requisições de busca e interage com o Elasticsearch.

### Arquivo `logstash/logstash.conf`

```
input {
tcp {
port => 5044
codec => json
}
}

output {
elasticsearch {
hosts => ["elasticsearch:9200"]
index => "api-logs-%{+YYYY.MM.dd}"
}
stdout { codec => rubydebug }
}
```

### Arquivo `prometheus/prometheus.yml`

```
global:
scrape_interval: 15s

scrape_configs:

- job_name: 'api'
  static_configs:
  - targets: ['api:9900']
- job_name: 'prometheus'
  static_configs: - targets: ['localhost:9090']
```

### Arquivo `grafana/provisioning/dashboards/custom_dashboard.json`

```
{
"dashboard": {
"id": null,
"title": "API Metrics",
"tags": [],
"timezone": "browser",
"schemaVersion": 16,
"version": 0,
"panels": [
{
"datasource": "Prometheus",
"targets": [
{
"expr": "openai_request_duration_seconds",
"format": "time_series",
"intervalFactor": 2,
"refId": "A"
}
],
"type": "graph",
"title": "OpenAI Request Duration"
},
{
"datasource": "Prometheus",
"targets": [
{
"expr": "elastic_request_duration_seconds",
"format": "time_series",
"intervalFactor": 2,
"refId": "A"
}
],
"type": "graph",
"title": "Elasticsearch Request Duration"
}
]
},
"overwrite": true
}
```

### Arquivo `grafana/provisioning/dashboards/custom_dashboard.yaml`

```
apiVersion: 1
providers:

- name: 'default'
  orgId: 1
  folder: ''
  type: file
  disableDeletion: false
  updateIntervalSeconds: 10
  options:
  path: /var/lib/grafana/dashboards
```

### Arquivo `loki/config/loki-local-config.yaml`

```
auth_enabled: false

server:
http_listen_port: 3100

ingester:
lifecycler:
address: 127.0.0.1
ring:
kvstore:
store: inmemory
replication_factor: 1
chunk_idle_period: 5m
chunk_retain_period: 30s
max_transfer_retries: 0

schema*config:
configs: - from: 2020-10-24
store: boltdb-shipper
object_store: filesystem
schema: v11
index:
prefix: index*
period: 168h

storage_config:
boltdb_shipper:
active_index_directory: /tmp/loki/index
cache_location: /tmp/loki/index_cache
cache_ttl: 24h
shared_store: filesystem
filesystem:
directory: /tmp/loki/chunks

limits_config:
enforce_metric_name: false
reject_old_samples: true
reject_old_samples_max_age: 168h

chunk_store_config:
max_look_back_period: 0s

table_manager:
retention_deletes_enabled: true
retention_period: 168h
```

### Arquivo `promtail/config/promtail-config.yaml`

```
server:
http_listen_port: 9080
grpc_listen_port: 0

positions:
filename: /var/log/positions.yaml

clients:

- url: http://loki:3100/loki/api/v1/push

scrape_configs:

- job_name: api
  static_configs: - targets: - localhost
  labels:
  job: api
  **path**: /var/log/\*_/_.log
```

### 🚀 Iniciando os Contêineres

1. **Navegue até o diretório do projeto clonado:**

   ```
   cd /home/ubuntu/forum-backend
   ```

2. **Inicie os contêineres:**

   ```
   docker-compose up -d --build
   ```

3. **Verifique o status dos contêineres:**

   ```
   docker ps
   ```

4. **Verifique os logs dos contêineres problemáticos (se houver):**
   ```
   docker logs -f prometheus
   docker logs -f logstash
   ```

## 🌐 Endpoints dos Serviços

**Certifique-se de liberar as portas no AWS Lightsail**

1. **API (Node.js):** [http://52.0.192.118:9900](http://52.0.192.118:9900)
2. **Elasticsearch:** [http://52.0.192.118:9200](http://52.0.192.118:9200)
3. **Kibana:** [http://52.0.192.118:5601](http://52.0.192.118:5601)
4. **Prometheus:** [http://52.0.192.118:9090](http://52.0.192.118:9090)
5. **Grafana:** [http://52.0.192.118:3000](http://52.0.192.118:3000) (usuário: `admin`, senha: `admin`)
6. **Loki:** [http://52.0.192.118:3100](http://52.0.192.118:3100)
