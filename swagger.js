const fs = require('fs');
const path = require('path');
const swaggerAutogen = require('swagger-autogen')();

const outputFile = './src/docs/swagger_output.json';
const routesDirectory = path.join(__dirname, './src/routes');
const entityDirectory = path.join(__dirname, './src/database/entity');

// Définition de base de Swagger
const doc = {
    info: {
        title: 'Evently API',
        description: 'API for Evently',
    },
    host: [
        'theodev.myftp.org:89',
    ],
    schemes: ['https'],
    consumes: ['application/json'],
    produces: ['application/json'],
    securityDefinitions: {
        Bearer: {
            type: 'apiKey',
            name: 'Authorization',
            in: 'header',
            description: 'Enter your Bearer token in the format **Bearer <token>**'
        }
    },
    security: [
        {
            Bearer: []
        }
    ],
    definitions: {
        // Les entités et enums seront ajoutés ici
    }
};

/**
 * Parse les enums dans le contenu d'un fichier.
 * Pour chaque enum trouvé, on ajoute dans doc.definitions une définition Swagger explicite.
 * Exemple généré pour l'enum RecurrencePattern :
 * {
 *   type: "string",
 *   enum: ["monthly", "yearly"]
 * }
 */
function parseEnums(fileContent) {
    const enumRegex = /export\s+enum\s+(\w+)\s*\{([^}]+)\}/g;
    let match;
    while ((match = enumRegex.exec(fileContent)) !== null) {
        const enumName = match[1];
        const enumBody = match[2];

        // Recherche de toutes les valeurs de l'enum
        const valueRegex = /(\w+)\s*=\s*["']([^"']+)["']/g;
        let valueMatch;
        const values = [];
        while ((valueMatch = valueRegex.exec(enumBody)) !== null) {
            values.push(valueMatch[2]);
        }
        // Ajoute la définition de l'enum dans Swagger
        doc.definitions[enumName] = {
            type: "string",
            enum: values
        };
    }
}

/**
 * Parse un fichier d'entité pour en extraire les propriétés.
 * Si le type d'une propriété correspond à une définition d'enum (déjà ajoutée dans doc.definitions),
 * on affecte comme valeur d'exemple la première valeur de l'enum.
 */
function parseEntityFile(filePath) {
    const fileContent = fs.readFileSync(filePath, 'utf-8');

    // Extraction du nom de l'entité
    const entityNameMatch = fileContent.match(/export class (\w+)\s+\{/);
    if (!entityNameMatch) return;
    const entityName = entityNameMatch[1];
    const properties = {};

    // Regex pour capturer les colonnes de base (@Column, @CreateDateColumn, etc.)
    const basicColumnRegex = /@(Column|CreateDateColumn|DeleteDateColumn|PrimaryGeneratedColumn)(?:\(\{[^}]*\}\))?\s*\n?\s*(\w+):\s*([\w\[\]]+);/g;
    let match;
    while ((match = basicColumnRegex.exec(fileContent)) !== null) {
        const propName = match[2];
        const propType = match[3];

        // Si le type correspond à un enum explicitement défini dans doc.definitions,
        // on utilise la première valeur de l'enum comme exemple.
        if (doc.definitions[propType] && doc.definitions[propType].enum) {
            properties[propName] = doc.definitions[propType].enum[0];
        }
        else if (propType === 'string') {
            properties[propName] = "foobar";
        } else if (propType === 'number') {
            properties[propName] = 666;
        } else if (propType === 'Date') {
            properties[propName] = "2019-01-01T00:00:00.000Z";
        } else if (propType === 'boolean') {
            properties[propName] = true;
        } else {
            // Par défaut, on garde le nom du type (peut être remplacé par une valeur par défaut si souhaité)
            properties[propName] = propType;
        }
    }

    // Regex pour capturer les relations (@OneToMany, @ManyToOne, etc.)
    const relationRegex = /@(OneToMany|ManyToOne|OneToOne|ManyToMany)\(\(\)\s*=>\s*(\w+)[^)]*\)\s*\n?\s*(\w+):\s*([\w\[\]]+);/g;
    while ((match = relationRegex.exec(fileContent)) !== null) {
        const relationType = match[1];
        const relatedEntity = match[2];
        const propName = match[3];
        if (relationType === 'OneToMany' || relationType === 'ManyToMany') {
            properties[propName] = [{ "$ref": `#/definitions/${relatedEntity}` }];
        } else {
            properties[propName] = { "$ref": `#/definitions/${relatedEntity}` };
        }
    }

    // Ajoute la définition de l'entité dans Swagger
    doc.definitions[entityName] = properties;
}

// Récupération des endpoints pour swagger-autogen
const endpointsFiles = fs.readdirSync(routesDirectory)
    .filter(file => file.endsWith('.ts'))
    .map(file => `./src/routes/${file}`);

// Parcours des fichiers d'entités et parse de chacun
fs.readdirSync(entityDirectory).forEach(file => {
    if (file.endsWith('.entity.ts')) {
        const filePath = path.join(entityDirectory, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');

        // On parse les enums présents dans le fichier
        parseEnums(fileContent);
        // Puis on parse l'entité
        parseEntityFile(filePath);
    }
});

// Génération du fichier swagger_output.json
swaggerAutogen(outputFile, endpointsFiles, doc);
