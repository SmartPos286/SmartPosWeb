tasks.register<Exec>("typecheck") {
    group = "verification"
    description = "Run TypeScript compiler check"
    commandLine("node", "./node_modules/typescript/bin/tsc", "--noEmit")
}

tasks.register<Exec>("viteBuild") {
    group = "build"
    description = "Build SmartPOS286 web production bundle"
    dependsOn("typecheck")
    commandLine("npm", "run", "build")
}

tasks.register("assemble") {
    group = "build"
    description = "Assemble SmartPOS286 web artifacts"
    dependsOn("viteBuild")
}

tasks.register("assembleDebug") {
    group = "build"
    description = "Assemble SmartPOS286 debug/web artifacts"
    dependsOn("assemble")
}

tasks.register<Exec>("lintWeb") {
    group = "verification"
    description = "Run ESLint on SmartPOS286 codebase"
    commandLine("npm", "run", "lint")
}

tasks.register("check") {
    group = "verification"
    description = "Run SmartPOS286 verification checks"
    dependsOn("typecheck", "lintWeb")
}

tasks.register("build") {
    group = "build"
    description = "Build and verify SmartPOS286"
    dependsOn("assemble", "check")
}

tasks.register<Delete>("clean") {
    group = "build"
    description = "Clean Vite build output"
    delete("dist")
}
