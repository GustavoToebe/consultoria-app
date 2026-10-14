# syntax=docker/dockerfile:1
# API: build com Maven + JDK 25, execução com JRE 25 Alpine e usuário sem privilégio.
# A biblioteca plataforma vem do GitHub Packages: o token de leitura entra como segredo do BuildKit (gh_token), só durante
# o RUN, sem ARG/ENV e sem ir para a imagem.
FROM maven:3.9-eclipse-temurin-25 AS build
WORKDIR /src
COPY pom.xml .
# jvm.config abre o javac para o Error Prone; precisa estar presente já no download das dependências.
COPY .mvn .mvn
RUN --mount=type=secret,id=gh_token,required=false \
    set -eu; \
    trap 'rm -f /root/.m2/settings.xml' EXIT; \
    if [ -s /run/secrets/gh_token ]; then \
      mkdir -p /root/.m2; \
      (umask 077; printf '<settings><servers><server><id>github</id><username>GustavoToebe</username><password>%s</password></server></servers></settings>' "$(cat /run/secrets/gh_token)" > /root/.m2/settings.xml); \
    fi; \
    mvn -B -q dependency:go-offline
COPY src src
# Os testes rodam no `mvn verify` da máquina de desenvolvimento (precisam de Docker para o Testcontainers).
RUN --mount=type=secret,id=gh_token,required=false \
    set -eu; \
    trap 'rm -f /root/.m2/settings.xml' EXIT; \
    if [ -s /run/secrets/gh_token ]; then \
      mkdir -p /root/.m2; \
      (umask 077; printf '<settings><servers><server><id>github</id><username>GustavoToebe</username><password>%s</password></server></servers></settings>' "$(cat /run/secrets/gh_token)" > /root/.m2/settings.xml); \
    fi; \
    mvn -B -q package -DskipTests -Djacoco.skip=true

FROM eclipse-temurin:25-jre-alpine
RUN addgroup -S treinos && adduser -S treinos -G treinos
WORKDIR /app
COPY --from=build /src/target/treinos-api-*.jar app.jar
USER treinos
EXPOSE 8080
ENV JAVA_TOOL_OPTIONS="-XX:+UseCompactObjectHeaders -XX:+ExitOnOutOfMemoryError -XX:MaxRAMPercentage=75"
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
