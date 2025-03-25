const fs = require('fs').promises;
const path = require('path');

// Main conversion function
async function convertOptifineCITtoSelect(inputDir, outputDir) {
    try {
        // Ensure output directory exists
        await fs.mkdir(outputDir, { recursive: true });
        
        // Process the resource pack
        await processDirectory(inputDir, outputDir, inputDir);
        console.log('Conversion completed successfully!');
    } catch (error) {
        console.error('Error during conversion:', error);
    }
}

// Recursively process directories
async function processDirectory(inputDir, outputDir, rootDir) {
    const entries = await fs.readdir(inputDir, { withFileTypes: true });
    
    for (const entry of entries) {
        const inputPath = path.join(inputDir, entry.name);
        const relativePath = path.relative(rootDir, inputDir);
        const outputPath = path.join(outputDir, relativePath, entry.name);

        if (entry.isDirectory()) {
            // Recursively process subdirectories
            if (entry.name === 'cit' && relativePath.includes('optifine')) {
                await processCITDirectory(inputPath, outputDir, rootDir);
            } else {
                await processDirectory(inputPath, outputDir, rootDir);
            }
        }
    }
}

// Process CIT directory specifically
async function processCITDirectory(citDir, outputDir, rootDir) {
    const entries = await fs.readdir(citDir, { withFileTypes: true });
    
    // Group properties by base item
    const itemGroups = new Map();
    
    for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.properties')) {
            const propertiesPath = path.join(citDir, entry.name);
            const properties = await parsePropertiesFile(propertiesPath);
            
            if (properties) {
                const items = properties.items.split(' ');
                const texture = properties.texture || entry.name.replace('.properties', '');
                const model = properties.model || texture;
                const name = properties['nbt.display.Name']?.replace('ipattern:', '');
                
                for (const item of items) {
                    if (!itemGroups.has(item)) {
                        itemGroups.set(item, []);
                    }
                    itemGroups.get(item).push({
                        name: name || texture,
                        model: `minecraft:item/${model.replace('./', '')}`
                    });
                }
            }
        }
    }

    // Generate select model files for each item group
    for (const [item, cases] of itemGroups) {
        const selectModel = createSelectModel(item, cases);
        const outputFileName = path.join(outputDir, 'assets', 'minecraft', 'models', 'item', `${item.split(':')[1]}.json`);
        
        await fs.mkdir(path.dirname(outputFileName), { recursive: true });
        await fs.writeFile(outputFileName, JSON.stringify(selectModel, null, 2));
        console.log(`Created model file for ${item} at ${outputFileName}`);
    }
}

// Parse .properties file
async function parsePropertiesFile(filePath) {
    try {
        const content = await fs.readFile(filePath, 'utf8');
        const properties = {};
        
        content.split('\n').forEach(line => {
            line = line.trim();
            if (line && !line.startsWith('#')) {
                const [key, value] = line.split('=');
                if (key && value) {
                    properties[key.trim()] = value.trim();
                }
            }
        });
        
        if (properties.type === 'item' && properties.items) {
            return properties;
        }
        return null;
    } catch (error) {
        console.error(`Error parsing properties file ${filePath}:`, error);
        return null;
    }
}

// Create select model JSON structure
function createSelectModel(item, cases) {
    const baseItem = item.split(':')[1];
    const fallbackModel = getFallbackModel(baseItem);
    
    return {
        model: {
            type: "minecraft:select",
            property: "minecraft:component",
            component: "minecraft:custom_name",
            cases: cases.map(caseEntry => ({
                when: caseEntry.name,
                model: {
                    type: "minecraft:model",
                    model: caseEntry.model
                }
            })),
            fallback: {
                type: "minecraft:model",
                model: fallbackModel
            }
        }
    };
}

// Get appropriate fallback model based on item type
function getFallbackModel(item) {
    const fallbackMap = {
        'diamond_sword': 'minecraft:item/diamond_sword',
        'iron_hoe': 'minecraft:item/iron_hoe',
        'bow': 'minecraft:item/bow',
        // Add more mappings as needed
    };
    
    return fallbackMap[item] || `minecraft:item/${item}`;
}

// Usage
const inputResourcePack = './input/';
const outputResourcePack = './output/';

convertOptifineCITtoSelect(inputResourcePack, outputResourcePack)
    .catch(error => console.error('Conversion failed:', error));