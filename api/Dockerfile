# API: build com Maven + JDK 21, execução com JRE 21 Alpine e usuário sem privilégio.
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
COPY pom.xml .
# jvm.config abre o javac para o Error Prone; precisa estar presente já no download das dependências.
COPY .mvn .mvn
RUN mvn -B -q dependency:go-offline
COPY src src
# Os testes rodam no `mvn verify` da máquina de desenvolvimento (precisam de Docker para o Testcontainers).
RUN mvn -B -q package -DskipTests -Djacoco.skip=true

FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S treinos && adduser -S treinos -G treinos
WORKDIR /app
COPY --from=build /src/target/treinos-api-*.jar app.jar
USER treinos
EXPOSE 8080
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75"
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
