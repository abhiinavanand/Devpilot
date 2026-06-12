import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

async function setup() {
    try {
        console.log('Starting setup...');

        // Install dependencies
        console.log('Installing dependencies...');
        await execPromise('npm install');

        // Run database migrations
        console.log('Running database migrations...');
        await execPromise('npm run migrate');

        // Seed the database
        console.log('Seeding the database...');
        await execPromise('npm run seed');

        console.log('Setup completed successfully!');
    } catch (error) {
        console.error('Error during setup:', error);
    }
}

setup();