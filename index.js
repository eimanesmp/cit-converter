const fs = require('fs').promises;
const path = require('path');

async function convertOptifineCITtoSelect(inputDir, outputDir) {
    try {
        console.log(`Starting conversion from ${inputDir} to ${outputDir}`);
        await fs.mkdir(outputDir, { recursive: true });
        await processDirectory(inputDir, outputDir, inputDir);
        console.log('Conversion completed successfully!');
    } catch (error) {
        console.error('Error during conversion:', error);
    }
}

async function processDirectory(inputDir, outputDir, rootDir) {
    try {
        const entries = await fs.readdir(inputDir, { withFileTypes: true });
        console.log(`Scanning directory: ${inputDir}, found ${entries.length} entries`);

        for (const entry of entries) {
            const inputPath = path.join(inputDir, entry.name);
            const relativePath = path.relative(rootDir, inputDir);
            const outputPath = path.join(outputDir, relativePath, entry.name);

            if (entry.isDirectory()) {
                if (entry.name === 'cit' && relativePath.includes('optifine')) {
                    console.log(`Found CIT directory: ${inputPath}`);
                    await processCITDirectory(inputPath, outputDir, rootDir);
                } else {
                    console.log(`Copying directory: ${inputPath}`);
                    await fs.mkdir(outputPath, { recursive: true });
                    await processDirectory(inputPath, outputPath, rootDir);
                }
            } else {
                // Copy non-CIT files (like textures)
                console.log(`Copying file: ${inputPath} to ${outputPath}`);
                await fs.copyFile(inputPath, outputPath);
            }
        }
    } catch (error) {
        console.error(`Error processing directory ${inputDir}:`, error);
    }
}

async function processCITDirectory(citDir, outputDir, rootDir) {
    try {
        const entries = await fs.readdir(citDir, { withFileTypes: true });
        console.log(`Processing CIT directory ${citDir}, found ${entries.length} entries`);

        const itemGroups = new Map();

        for (const entry of entries) {
            if (entry.isFile() && entry.name.endsWith('.properties')) {
                const propertiesPath = path.join(citDir, entry.name);
                console.log(`Parsing properties file: ${propertiesPath}`);
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
                } else {
                    console.log(`No valid CIT data found in ${propertiesPath}`);
                }
            }
        }

        if (itemGroups.size === 0) {
            console.log('No CIT properties found to convert');
            return;
        }

        for (const [item, cases] of itemGroups) {
            const selectModel = createSelectModel(item, cases);
            const outputFileName = path.join(outputDir, 'assets', 'minecraft', 'models', 'item', `${item.split(':')[1]}.json`);
            
            await fs.mkdir(path.dirname(outputFileName), { recursive: true });
            await fs.writeFile(outputFileName, JSON.stringify(selectModel, null, 2));
            console.log(`Created model file: ${outputFileName}`);
        }
    } catch (error) {
        console.error(`Error processing CIT directory ${citDir}:`, error);
    }
}

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
            console.log(`Valid CIT properties found: items=${properties.items}`);
            return properties;
        }
        console.log(`Invalid CIT file format in ${filePath}`);
        return null;
    } catch (error) {
        console.error(`Error parsing ${filePath}:`, error);
        return null;
    }
}

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

function getFallbackModel(item) {
    const fallbackMap = {
        'diamond_sword': 'minecraft:item/diamond_sword',
        'iron_hoe': 'minecraft:item/iron_hoe',
        'bow': 'minecraft:item/bow',
    };
    return fallbackMap[item] || `minecraft:item/${item}`;
}

// Usage
const inputResourcePack = './input';
const outputResourcePack = './output';

convertOptifineCITtoSelect(inputResourcePack, outputResourcePack)
    .catch(error => console.error('Conversion failed:', error));