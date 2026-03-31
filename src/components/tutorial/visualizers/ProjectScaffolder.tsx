
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Package, Copy, Check, Download,
  Settings2, ExternalLink,
  Box
} from 'lucide-react';
import { Dependency } from '../tutorial-types';

interface Props {
  dependencies: Dependency[];
  projectName?: string;
}

const ProjectScaffolder: React.FC<Props> = ({ dependencies, projectName = "spring-masterclass" }) => {
  const [format, setFormat] = useState<'maven' | 'gradle'>('maven');
  const [copied, setCopied] = useState(false);

  const generateMaven = () => {
    const depsXml = dependencies.map(dep => `
        <dependency>
            <groupId>${dep.groupId}</groupId>
            <artifactId>${dep.artifactId}</artifactId>${dep.version ? `\n            <version>${dep.version}</version>` : ''}${dep.scope && dep.scope !== 'compile' ? `\n            <scope>${dep.scope}</scope>` : ''}
        </dependency>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.2.2</version>
        <relativePath/>
    </parent>

    <groupId>com.example</groupId>
    <artifactId>${projectName}</artifactId>
    <version>0.0.1-SNAPSHOT</version>
    <name>${projectName}</name>

    <properties>
        <java.version>17</java.version>
    </properties>

    <dependencies>${depsXml}
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
        </plugins>
    </build>
</project>`;
  };

  const generateGradle = () => {
    const depsGradle = dependencies.map(dep => {
      const config = dep.scope === 'test' ? 'testImplementation' :
                     dep.scope === 'provided' ? 'compileOnly' :
                     dep.scope === 'runtime' ? 'runtimeOnly' : 'implementation';
      return `    ${config} '${dep.groupId}:${dep.artifactId}${dep.version ? `:${dep.version}` : ''}'`;
    }).join('\n');

    return `plugins {
    id 'java'
    id 'org.springframework.boot' version '3.2.2'
    id 'io.spring.dependency-management' version '1.1.4'
}

group = 'com.example'
version = '0.0.1-SNAPSHOT'
sourceCompatibility = '17'

repositories {
    mavenCentral()
}

dependencies {
${depsGradle}
    testImplementation 'org.springframework.boot:spring-boot-starter-test'
}

tasks.named('test') {
    useJUnitPlatform()
}`;
  };

  const code = format === 'maven' ? generateMaven() : generateGradle();

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = format === 'maven' ? 'pom.xml' : 'build.gradle';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="glass-card rounded-2xl overflow-hidden flex flex-col relative">
      <div className="p-6 border-b border-outline-variant bg-surface-variant/30">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Package className="text-primary" size={20} />
            </div>
            <div>
              <h3 className="text-on-surface font-bold text-lg">Project Scaffolder</h3>
              <p className="text-secondary text-xs">Generate build configuration for this lesson</p>
            </div>
          </div>
          <div className="flex bg-surface-container-high p-1 rounded-lg border border-outline-variant">
            <button
              onClick={() => setFormat('maven')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${format === 'maven' ? 'bg-surface text-on-surface shadow-sm' : 'text-secondary hover:text-on-surface'}`}
            >
              Maven
            </button>
            <button
              onClick={() => setFormat('gradle')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${format === 'gradle' ? 'bg-surface text-on-surface shadow-sm' : 'text-secondary hover:text-on-surface'}`}
            >
              Gradle
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {dependencies.map((dep, idx) => (
            <motion.div
              key={`${dep.groupId}-${dep.artifactId}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-surface/40 border border-outline-variant/60 p-3 rounded-xl flex items-start gap-3 group hover:border-primary/30 hover:bg-surface-variant/40 transition-colors"
            >
              <div className="mt-1">
                <Box size={14} className="text-secondary group-hover:text-primary transition-colors" />
              </div>
              <div className="overflow-hidden">
                <h4 className="text-on-surface-variant text-xs font-bold truncate">{dep.artifactId}</h4>
                <p className="text-secondary text-[10px] leading-tight mt-1">{dep.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="relative group">
        <div className="absolute top-4 right-4 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleCopy}
            className="p-2 bg-surface-container-high/90 hover:bg-surface-variant text-on-surface-variant rounded-lg border border-outline-variant transition-all flex items-center gap-2 text-xs font-medium"
          >
            {copied ? <Check size={14} className="text-tertiary" /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={handleDownload}
            className="p-2 bg-surface-container-high/90 hover:bg-surface-variant text-on-surface-variant rounded-lg border border-outline-variant transition-all flex items-center gap-2 text-xs font-medium"
          >
            <Download size={14} />
            Download
          </button>
        </div>

        <div className="bg-surface-container p-6 max-h-[400px] overflow-y-auto tutorial-scroll">
          <pre className="font-mono text-sm leading-6 text-on-surface-variant">
            <code>{code}</code>
          </pre>
        </div>
      </div>

      <div className="p-4 bg-surface border-t border-outline-variant flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] text-secondary font-medium uppercase tracking-wider">
          <Settings2 size={12} />
          Environment: Java 17, Spring Boot 3.2.2
        </div>
        <a
          href="https://start.spring.io"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-primary hover:text-primary/80 flex items-center gap-1 font-bold uppercase tracking-wider transition-colors"
        >
          Spring Initializr
          <ExternalLink size={10} />
        </a>
      </div>
    </div>
  );
};

export default ProjectScaffolder;
