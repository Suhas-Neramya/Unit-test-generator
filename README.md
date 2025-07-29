# PLSQL Unit Test Generator

A VS Code extension that generates PLSQL unit tests using AI. This extension helps you create comprehensive unit tests for your PLSQL code by leveraging AI capabilities.

## Features

- Interactive chat interface for generating PLSQL unit tests
- Uses your knowledge base and example tests for better results
- Configurable API key and model settings
- Syntax-highlighted code blocks in the chat
- Progress indicators and error handling

## Installation

1. Download the `.vsix` file from the releases page
2. Open VS Code
3. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
4. Type "Install from VSIX" and select the downloaded file

## Configuration

1. Open VS Code settings (Ctrl+,)
2. Search for "PLSQL Test Generator"
3. Enter your OpenAI API key in the "API Key" field
4. Optionally change the model if needed

## Usage

1. Click the PLSQL Test Generator icon in the VS Code sidebar
2. Paste your PLSQL code into the text area
3. Click "Generate Test" or press Enter
4. The generated unit test will appear in the chat

## Knowledge Base and Examples

The extension uses two files to improve test generation:

1. `resources/knowledge_base.txt`: Contains your PLSQL standards and practices
2. `resources/examples.sql`: Contains example unit tests

You can modify these files to match your specific requirements.

## Requirements

- VS Code 1.80.0 or higher
- OpenAI API key

## Extension Settings

* `plsqlTestGenerator.apiKey`: Your OpenAI API key
* `plsqlTestGenerator.model`: The OpenAI model to use (default: gpt-4o-mini)

## Known Issues

- None at the moment

## Release Notes

### 0.0.1

Initial release of PLSQL Unit Test Generator 